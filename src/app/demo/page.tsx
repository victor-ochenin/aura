// localhost:3000/demo

"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function DemoPage() {
    const [loading, setLoading] = useState(false);
    const [loading2, setLoading2] = useState(false);

    const handleBloaking = async () => {
        setLoading(true);
        await fetch("/api/demo/bloaking", {method: "POST"});
        setLoading(false);
    }

    const handleBackground = async () => {
        setLoading2(true);
        await fetch("/api/demo/background", {method: "POST"});
        setLoading2(false);
    }

    return(
        <div className="p-8 space-x-4">
            <Button disabled={loading} onClick={handleBloaking}>
                {loading ? "Loading..." : "Bloaking"}
            </Button>
            <Button disabled={loading2} onClick={handleBackground}>
                {loading2 ? "Loading..." : "Background"}
            </Button>
        </div>
    )
};