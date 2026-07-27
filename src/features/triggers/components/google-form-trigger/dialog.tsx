"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { generateGoogleFormScript } from "./utils";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const GoogleFormTriggerDialog = ({
    open,
    onOpenChange,
}: Props) => {
    const params = useParams();
    const workflowId = params.workflowId as string;

    // Construct the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl =
        `${baseUrl}/api/webhooks/google-form?workflowId=${workflowId}`;

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            toast.success("Webhook URL copied to clipboard");
        } catch {
            toast.error("Failed to copy URL");
        }
    };

    const copyScript = async () => {
        try {
            const script = generateGoogleFormScript(webhookUrl);
            await navigator.clipboard.writeText(script);
            toast.success("Script copied to clipboard");
        } catch {
            toast.error("Failed to copy script");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Google Form Trigger Configuration</DialogTitle>
                    <DialogDescription>
                        Use this webhook URL in your Google Form&apos;s Apps Script to trigger
                        this workflow when a form is submitted.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {/* Webhook URL */}
                    <div className="space-y-2">
                        <Label>Webhook URL</Label>
                        <div className="flex gap-2">
                            <Input
                                value={webhookUrl}
                                readOnly
                                className="font-mono text-xs"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={copyToClipboard}
                            >
                                <CopyIcon className="size-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Setup Instructions */}
                    <div className="space-y-2">
                        <Label>Setup Instructions</Label>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Open your Google Form</li>
                            <li>Click the three dots menu → Script editor</li>
                            <li>Copy and paste the script below</li>
                            <li>Replace WEBHOOK_URL with your webhook URL above</li>
                            <li>Save and click &quot;Triggers&quot; → Add Trigger</li>
                            <li>Choose: From form → On form submit → Save</li>
                        </ol>
                    </div>

                    {/* Google Apps Script */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Google Apps Script</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={copyScript}
                                className="gap-2"
                            >
                                <CopyIcon className="size-3" />
                                Copy Script
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This script includes your webhook URL and handles form submissions
                        </p>
                        <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                            {generateGoogleFormScript(webhookUrl)}
                        </pre>
                    </div>

                    {/* Available Variables */}
                    <div className="space-y-2">
                        <Label>Available Variables</Label>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                                    {"{{googleForm.respondentEmail}}"}
                                </code>
                                <span className="text-muted-foreground">- Respondent&apos;s email</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                                    {"{{googleForm.responses['Question Name']}}"}
                                </code>
                                <span className="text-muted-foreground">- Specific answer</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                                    {"{{json googleForm.responses}}"}
                                </code>
                                {" "}
                                <span className="text-muted-foreground">- All responses as JSON</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
