"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form"
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";


const formSchema = z.object({
    variableName: z
        .string()
        .min(1, { message: "Variable name is reqired." })
        .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/,
            { message: "Variable name should only start with letter or underscore and container onyl letters, numbers, and Underscores" })
    ,
    endpoint: z.string().min(1, { message: "Please enter a valid URL." }),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    body: z
        .string()
        .optional()
    // .refine()
})
export type httpRequestFormValues = z.infer<typeof formSchema>

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void
    onSubmit?: (values: z.infer<typeof formSchema>) => void,
    deafultValues?: Partial<httpRequestFormValues>
}

export const HttpRequestDialog = ({
    open,
    onOpenChange,
    onSubmit,
    deafultValues = {}

}: Props) => {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: deafultValues.variableName || "",
            endpoint: deafultValues.endpoint || "",
            method: deafultValues.method,
            body: deafultValues.body || "",
        }
    })

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: deafultValues.variableName || "",
                endpoint: deafultValues.endpoint || "",
                method: deafultValues.method,
                body: deafultValues.body || ""
            })
        }
    }, [open, deafultValues, form])

    const watchVariableName = form.watch("variableName") || "TheApiCall"
    const watchMethod = form.watch("method");
    const showBodyField = ["POST", "PUT", "PATCH"].includes(watchMethod);
    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        if (onSubmit) {
            onSubmit(values);
        }
        onOpenChange(false)
    }


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>HTTP Request Trigger</DialogTitle>
                    <DialogDescription>
                        Configure the setting for the HTTP trigger node.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-8 mt-4"
                    >
                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Variable Name</FormLabel>
                                    <Input placeholder="TheApiCall" {...field} />
                                    <FormDescription>
                                        Use this name to refer the result in  other Node: {" "}
                                        {`{{${watchVariableName}.httpResponse.data}}`}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="method"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Method</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}>
                                        <FormControl className="">
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a Method" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="GET">GET</SelectItem>
                                            <SelectItem value="PUT">PUT</SelectItem>
                                            <SelectItem value="POST">POST</SelectItem>
                                            <SelectItem value="PATCH">PATCH</SelectItem>
                                            <SelectItem value="DELETE">DELETE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Select the HTTP method for this request.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="endpoint"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Endpoint</FormLabel>
                                    <Input placeholder="https://api.example.com/users/{{httpsResponse.data.id}}" {...field} />
                                    <FormDescription>
                                        Static URL or use {"{{variables}}"} for simple values
                                        or {"{{json variable}}"} to stringify objects.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {showBodyField && (
                            <FormField
                                control={form.control}
                                name="body"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Request Body</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={`{
  "userId": "{{httpResponse.data.id}}",
  "name": "{{httpResponse.data.name}}",
  "items": "{{httpResponse.data.items}}"
}`}
                                                className="min-h-[120px] font-mono text-sm"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            JSON With template {"{{variables}}"}.
                                            use {"{{variable}}"} for simple values or
                                            {"{{json variable}}"} to stringify objects.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter className="mt-4">
                            <Button type="submit"> Save</Button>
                        </DialogFooter>
                    </form>

                </Form>
            </DialogContent>
        </Dialog>
    )
}