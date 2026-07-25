import Handlebars from "handlebars"
import type { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import ky, { type Options as KyOptions } from "ky";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import { inngest } from "@/inngest/client";

Handlebars.registerHelper("json", (context)=> {
    const jsonString = JSON.stringify(context,null,2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString; 
});

type HttpRequestData = {
    variableName: string
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    body?: string
}

export const httpRequestExecutor: NodeExecutor<HttpRequestData> = async ({
    data,
    nodeId,
    context,
    step,
}) =>{

    await inngest.realtime.publish(httpRequestChannel.status, {
        nodeId,
        status: "loading",
    });

    if(!data.endpoint){
        await inngest.realtime.publish(httpRequestChannel.status, {
            nodeId,
            status: "error",
        });
        throw new NonRetriableError("HTTP Request node: No Endpoint Condigured.");
    }
    if(!data.variableName){
        await inngest.realtime.publish(httpRequestChannel.status, {
            nodeId,
            status: "error",
        });
        throw new NonRetriableError("Variable Name is not configured.");
    }
    if(!data.method){
        await inngest.realtime.publish(httpRequestChannel.status, {
            nodeId,
            status: "error",
        });
        throw new NonRetriableError("Method not configured.")
    }

    try {
        const result = await step.run("http-request",async()=>{
            const endpoint = Handlebars.compile(data.endpoint)(context);
            const method  = data.method;
            const options: KyOptions = {method}

            if(["POST","PUT","PATCH"].includes(method)){
                const resolved = Handlebars.compile(data.body || "{}")(context);
                console.log("BODY: ", resolved);
                JSON.parse(resolved);
                options.body = resolved;
                options.headers = {
                    "Content-type" : "application/json",
                } 
            }

            const response = await ky(endpoint,options);
            const contentType = response.headers.get("content-type");
            const responseData = contentType?.includes("application/json")
            ? await response.json()
            : await response.text();

            const responsePayload = {
                httpResponse:{
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData
                },
            };

            return {
            ...context,
            [data.variableName]: responsePayload
            }
        });

        await inngest.realtime.publish(httpRequestChannel.status, {
            nodeId,
            status: "success",
        });

        return result;
    } catch (error) {
        await inngest.realtime.publish(httpRequestChannel.status, {
            nodeId,
            status: "error",
        });
        throw error;
    }
}