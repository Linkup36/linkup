import { CheckCircle2, MoreHorizontal, Truck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStateMeta, normalizeState, orderStateMachine } from "@/shared/state-machines";

interface OrderTimelineProps {
    status: string;
    shipmentStatus?: string;
}

const STEP_IDS = ['pending', 'processing', 'transit', 'delivered'] as const;

export function OrderTimeline({ status: rawStatus }: OrderTimelineProps) {
    const status = normalizeState(orderStateMachine, rawStatus) ?? (rawStatus || 'pending').toLowerCase();
    const meta = getStateMeta(orderStateMachine, status);
    const currentStepIdx = meta.stepIndex ?? 0;

    const getStepStatus = (step: string) => {
        if (status === 'cancelled') return 'cancelled';
        if (status === 'refunded' || status === 'disputed') return 'complete';

        const targetIdx = STEP_IDS.indexOf(step as (typeof STEP_IDS)[number]);
        if (currentStepIdx >= targetIdx) return 'complete';
        if (currentStepIdx === targetIdx - 1) return 'current';
        return 'upcoming';
    };

    const getDynamicLabel = (stepId: string) => {
        if (status === 'refunded' || status === 'disputed') return meta.shortLabel || meta.label;
        const targetIdx = STEP_IDS.indexOf(stepId as (typeof STEP_IDS)[number]);
        if (currentStepIdx === targetIdx && meta.shortLabel) {
            return meta.shortLabel;
        }
        return steps.find(s => s.id === stepId)?.label || '';
    };

    const steps = [
        { id: 'pending', label: 'Logged', icon: CheckCircle2 },
        { id: 'processing', label: 'Processing', icon: MoreHorizontal },
        { id: 'transit', label: 'Transit', icon: Truck },
        { id: 'delivered', label: 'Secured', icon: ShieldCheck }
    ];

    const getProgressWidth = () => {
        const allStatuses = [
            'pending', 'confirmed', 'awaiting_agent', 'accepted', 
            'out_for_pickup', 'arrived_at_seller', 'picked_up', 
            'out_for_delivery', 'arrived_at_destination', 'delivered', 'completed'
        ];
        const idx = allStatuses.indexOf(status);
        if (idx === -1) return '0%';
        return `${((idx + 1) / allStatuses.length) * 100}%`;
    };

    return (
        <div className="relative h-20 flex items-center mb-6">
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-muted -translate-y-1/2 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),.5)]"
                    style={{ width: getProgressWidth() }}
                />
            </div>

            <div className="relative w-full flex justify-between">
                {steps.map((step, idx) => {
                    const stepStatus = getStepStatus(step.id);
                    return (
                        <div key={idx} className="flex flex-col items-center gap-2.5 w-1/4">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 z-10",
                                stepStatus === 'complete' ? "bg-white border-primary text-primary shadow-lg shadow-primary/10 scale-105" :
                                    stepStatus === 'current' ? "bg-white border-primary text-primary animate-pulse" :
                                        "bg-white border-muted text-muted-foreground/30"
                            )}>
                                <step.icon size={18} strokeWidth={stepStatus === 'complete' ? 3 : 2} />
                            </div>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-[0.15em] transition-colors duration-300",
                                stepStatus === 'complete' ? "text-foreground" : "text-muted-foreground/50"
                            )}>{getDynamicLabel(step.id)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
