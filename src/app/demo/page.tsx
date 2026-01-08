// localhost:3000/demo

"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function DemoPage() {
    const { userId }= useAuth(); 

    const [loading, setLoading] = useState(false);
    const [loading2, setLoading2] = useState(false);

    const handleBloaking = async () => {
        setLoading(true);
        await fetch("/api/demo/bloaking", {method: "POST"});
        setLoading(false);
    };

    const handleBackground = async () => {
        setLoading2(true);
        await fetch("/api/demo/background", {method: "POST"});
        setLoading2(false);
    };

    // Client error - throws in the browser
    const handleClientError = async () => {
        Sentry.logger.info("User attempting to click on client function", { userId });
        throw new Error("Client error: something went wrong!");
    };

    // Api error - triggers server side error
    const handleApiError = async () => {
        throw new Error("Client error: something went wrong!");
    };

    // Inngest error - triggers error in background function
    const handleInngestError = async () => {
        await fetch("/api/demo/inngest-error", {method: "POST"});
    };

    return(
        <div className="p-8 space-x-4">
            <Button disabled={loading} onClick={handleBloaking}>
                {loading ? "Loading..." : "Bloaking"}
            </Button>
            <Button disabled={loading2} onClick={handleBackground}>
                {loading2 ? "Loading..." : "Background"}
            </Button>
            <Button variant="destructive" onClick={handleClientError}>
                Client Error
            </Button>
            <Button variant="destructive" onClick={handleApiError}>
                API Error
            </Button>
            <Button variant="destructive" onClick={handleInngestError}>
                Inngest Error
            </Button>
        </div>
    )
};