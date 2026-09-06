import { useEffect, useState } from "react";
import api from "@/lib/api";

const ConfigContext = { cs_whatsapp: "6281234567890" };
let cached = null;

export function usePublicConfig() {
    const [config, setConfig] = useState(cached || ConfigContext);

    useEffect(() => {
        if (cached) return;
        api.get("/public/config")
            .then((res) => {
                cached = res.data;
                setConfig(res.data);
            })
            .catch(() => {});
    }, []);

    return config;
}

export function waLink(config, message) {
    const text = encodeURIComponent(message || "Halo CS Short Card, saya butuh bantuan.");
    return `https://wa.me/${config.cs_whatsapp}?text=${text}`;
}
