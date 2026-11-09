import { MapPin, LocateFixed, Phone } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LiveTrackingMap } from "./LiveTrackingMap";

interface OrderShipmentIntelProps {
    shipment: any;
}

export function OrderShipmentIntel({ shipment }: OrderShipmentIntelProps) {
    const [riderCoords, setRiderCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Fetch rider profile separately with primary key fallback
    const { data: riderProfile } = useQuery({
        queryKey: ["rider-profile", shipment?.rider_id],
        queryFn: async () => {
            if (!shipment?.rider_id) return null;
            const { data, error } = await supabase
                .from("profiles")
                .select("id, display_name, avatar_url, phone")
                .eq("id", shipment.rider_id)
                .maybeSingle();

            if (error || !data) {
                const { data: fallbackData } = await supabase
                    .from("profiles")
                    .select("id, display_name, avatar_url, phone")
                    .eq("user_id", shipment.rider_id)
                    .maybeSingle();
                return fallbackData;
            }
            return data;
        },
        enabled: !!shipment?.rider_id,
    });
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        if (!isSharing || !shipment?.id) return;

        console.log("Starting live location sharing for buyer...");
        let watchId: number;

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const { error } = await (supabase as any)
                        .from("shipments")
                        .update({
                            buyer_latitude: latitude,
                            buyer_longitude: longitude,
                            buyer_location_last_updated: new Date().toISOString()
                        })
                        .eq("id", shipment.id);

                    if (error) console.error("Error updating buyer location:", error);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    toast.error("Location access denied. Tracking disabled.");
                    setIsSharing(false);
                },
                { enableHighAccuracy: true }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [isSharing, shipment?.id]);

    useEffect(() => {
        if (!shipment?.rider_id) return;

        // Initial fetch
        const fetchRiderLocation = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("latitude, longitude")
                .eq("id", shipment.rider_id)
                .single();
            if (data?.latitude && data?.longitude) {
                setRiderCoords({ lat: data.latitude, lng: data.longitude });
            }
        };

        fetchRiderLocation();

        // Realtime subscription
        const channel = supabase
            .channel(`rider-location-${shipment.rider_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${shipment.rider_id}`
                },
                (payload: any) => {
                    const { latitude, longitude } = payload.new;
                    if (latitude && longitude) {
                        setRiderCoords({ lat: latitude, lng: longitude });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shipment?.rider_id]);

    if (!shipment) {
        return (
            <div className="bg-muted/30 p-5 rounded-xl border border-dashed border-black/5 text-center">
                <p className="text-[11px] font-bold text-red-600 lowercase tracking-tight italic">
                    Waiting for agent to be assigned to this order..
                </p>
            </div>
        );
    }

    const buyerCoordsState = isSharing ? riderCoords : null; // placeholder for actual buyer coords

    return (
        <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-card p-4 rounded-xl border border-border/50 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Logistics Identifier</p>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/50 bg-muted/30">{shipment.tracking_code}</Badge>
                </div>

                {!shipment.rider_id ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Awaiting Courier Assignment</p>
                            <p className="text-[11px] text-amber-700 font-medium">A dispatch rider will be assigned to fulfill this delivery shortly.</p>
                        </div>
                    </div>
                ) : riderProfile ? (
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/20 border border-border/40">
                        <Avatar className="h-11 w-11 rounded-lg border-2 border-primary/20 shrink-0">
                            <AvatarImage src={riderProfile.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-black">
                                {riderProfile.display_name?.[0]?.toUpperCase() || "R"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Authenticated Courier</p>
                            <p className="text-[13px] font-black text-foreground truncate">{riderProfile.display_name || "Assigned Courier"}</p>
                            {riderProfile.phone ? (
                                <a 
                                    href={`tel:${riderProfile.phone.replace(/[^0-9+]/g, '')}`} 
                                    className="text-[11px] text-primary hover:underline font-bold inline-flex items-center gap-1 mt-0.5"
                                    title="Click to dial courier"
                                >
                                    <Phone size={10} className="text-emerald-600" />
                                    <span>{riderProfile.phone}</span>
                                </a>
                            ) : (
                                <p className="text-[10px] text-muted-foreground italic">No phone number on file</p>
                            )}
                        </div>
                        {riderProfile.phone ? (
                            <Button
                                size="sm"
                                asChild
                                className="rounded-full h-8 text-[11px] font-black px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
                            >
                                <a href={`tel:${riderProfile.phone.replace(/[^0-9+]/g, '')}`}>
                                    <Phone size={13} strokeWidth={2.5} />
                                    <span>Call Courier</span>
                                </a>
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toast.info("Courier phone number is not available on their profile.")}
                                className="rounded-full h-8 text-[10px] font-bold px-3 text-muted-foreground border-border/60 shrink-0"
                            >
                                <Phone size={12} className="mr-1 opacity-50" />
                                <span>No Phone</span>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-muted-foreground">Loading courier details...</p>
                    </div>
                )}
            </div>

            <div className={cn(
                "p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all duration-500 relative overflow-hidden",
                riderCoords ? "border-primary shadow-lg shadow-primary/20" : "bg-primary/[0.02] border-primary/5"
            )}>
                {riderCoords ? (
                    <div className="relative">
                        <div className="absolute top-1.5 left-1.5 z-[1000] flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-md border border-border/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-foreground">Live</span>
                        </div>
                        <LiveTrackingMap riderCoords={riderCoords} buyerCoords={buyerCoordsState} />
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <MapPin size={18} strokeWidth={3} />
                            <p className="text-sm font-black tracking-tight">Deployment Terminal</p>
                        </div>
                        <p className="text-xs font-medium leading-relaxed pl-7 text-muted-foreground">
                            Your asset is currently in the Linkup Global logistics network. Real-time updates will fire as the status evolves.
                        </p>
                    </div>
                )}
            </div>

            {/* Buyer Live Sharing Policy */}
            <div className={cn(
                "col-span-1 md:col-span-2 p-4 rounded-xl border flex items-center justify-between transition-all duration-300",
                isSharing ? "bg-green-50/50 border-green-200" : "bg-muted/10 border-black/[0.03]"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        isSharing ? "bg-green-100 text-green-600" : "bg-black/5 text-muted-foreground"
                    )}>
                        <LocateFixed size={18} strokeWidth={3} className={isSharing ? "animate-pulse" : ""} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Mutual Visibility</p>
                        <p className="text-[13px] font-black text-foreground">Share Live Position</p>
                        <p className="text-[10px] font-medium text-muted-foreground opacity-60">Enable real-time tracking for your logistics partner.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-xl border border-black/5 shadow-sm">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", isSharing ? "text-green-600" : "text-muted-foreground")}>
                        {isSharing ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                        checked={isSharing}
                        onCheckedChange={setIsSharing}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
            </div>
        </div>
    );
}
