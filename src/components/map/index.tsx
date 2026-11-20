"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

export const MapView = dynamic(() => import("./map-picker"), { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-xl" /> });
