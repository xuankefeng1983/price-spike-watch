import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface DataRangeOut {
    first_date: string;
    last_date: string;
}
export interface EventDetailOut {
    event: SpikeEvent;
    fuel_mix: FuelPoint[];
    fuel_mix_available: boolean;
    fuel_shift?: FuelShift | null;
    trace: TracePoint[];
}
export interface ExplainIn {
    end: string;
    event_id?: string | null;
    region?: string | null;
    start: string;
}
export interface ExplainOut {
    caveat: string;
    headline: string;
    how_to_read: string[];
    key_points: string[];
    model: string;
    summary: string;
    view_label: string;
}
export interface FuelPoint {
    fuel: string;
    mw: number;
    t: string;
}
export interface FuelShift {
    battery_rise_mw: number;
    coal_rise_mw: number;
    gas_rise_mw: number;
    solar_drop_mw: number;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface RegionStat {
    events: number;
    hours_spiked: number;
    peak_price: number;
    region_id: string;
    severity_m_aud: number;
}
export interface SpikeEvent {
    avg_price: number;
    duration_min: number;
    event_end: string;
    event_id: string;
    event_start: string;
    peak_demand_mw: number;
    peak_price: number;
    region_id: string;
    severity_m_aud: number;
}
export interface SummaryOut {
    by_region: RegionStat[];
    end: string;
    events: number;
    hours_spiked: number;
    peak_price: number | null;
    severity_m_aud: number;
    start: string;
}
export interface TracePoint {
    demand_mw: number;
    price: number;
    t: string;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export const dataRange = async (options?: RequestInit): Promise<{
    data: DataRangeOut;
}> =>{
    const res = await fetch("/api/data-range", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const dataRangeKey = ()=>{
    return [
        "/api/data-range"
    ] as const;
};
export function useDataRange<TData = {
    data: DataRangeOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: DataRangeOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: dataRangeKey(),
        queryFn: ()=>dataRange(),
        ...options?.query
    });
}
export function useDataRangeSuspense<TData = {
    data: DataRangeOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: DataRangeOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: dataRangeKey(),
        queryFn: ()=>dataRange(),
        ...options?.query
    });
}
export const defaultWindow = async (options?: RequestInit): Promise<{
    data: DataRangeOut;
}> =>{
    const res = await fetch("/api/default-window", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const defaultWindowKey = ()=>{
    return [
        "/api/default-window"
    ] as const;
};
export function useDefaultWindow<TData = {
    data: DataRangeOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: DataRangeOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: defaultWindowKey(),
        queryFn: ()=>defaultWindow(),
        ...options?.query
    });
}
export function useDefaultWindowSuspense<TData = {
    data: DataRangeOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: DataRangeOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: defaultWindowKey(),
        queryFn: ()=>defaultWindow(),
        ...options?.query
    });
}
export interface ListEventsParams {
    start: string;
    end: string;
    region?: string | null;
    sort?: string;
    limit?: number;
}
export const listEvents = async (params: ListEventsParams, options?: RequestInit): Promise<{
    data: SpikeEvent[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params.start != null) searchParams.set("start", String(params.start));
    if (params.end != null) searchParams.set("end", String(params.end));
    if (params?.region != null) searchParams.set("region", String(params?.region));
    if (params?.sort != null) searchParams.set("sort", String(params?.sort));
    if (params?.limit != null) searchParams.set("limit", String(params?.limit));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/events?${queryString}` : "/api/events";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listEventsKey = (params?: ListEventsParams)=>{
    return [
        "/api/events",
        params
    ] as const;
};
export function useListEvents<TData = {
    data: SpikeEvent[];
}>(options: {
    params: ListEventsParams;
    query?: Omit<UseQueryOptions<{
        data: SpikeEvent[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listEventsKey(options.params),
        queryFn: ()=>listEvents(options.params),
        ...options?.query
    });
}
export function useListEventsSuspense<TData = {
    data: SpikeEvent[];
}>(options: {
    params: ListEventsParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: SpikeEvent[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listEventsKey(options.params),
        queryFn: ()=>listEvents(options.params),
        ...options?.query
    });
}
export interface GetEventParams {
    event_id: string;
}
export const getEvent = async (params: GetEventParams, options?: RequestInit): Promise<{
    data: EventDetailOut;
}> =>{
    const res = await fetch(`/api/events/${params.event_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getEventKey = (params?: GetEventParams)=>{
    return [
        "/api/events/{event_id}",
        params
    ] as const;
};
export function useGetEvent<TData = {
    data: EventDetailOut;
}>(options: {
    params: GetEventParams;
    query?: Omit<UseQueryOptions<{
        data: EventDetailOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getEventKey(options.params),
        queryFn: ()=>getEvent(options.params),
        ...options?.query
    });
}
export function useGetEventSuspense<TData = {
    data: EventDetailOut;
}>(options: {
    params: GetEventParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: EventDetailOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getEventKey(options.params),
        queryFn: ()=>getEvent(options.params),
        ...options?.query
    });
}
export const explainView = async (data: ExplainIn, options?: RequestInit): Promise<{
    data: ExplainOut;
}> =>{
    const res = await fetch("/api/explain", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useExplainView(options?: {
    mutation?: UseMutationOptions<{
        data: ExplainOut;
    }, ApiError, ExplainIn>;
}) {
    return useMutation({
        mutationFn: (data)=>explainView(data),
        ...options?.mutation
    });
}
export interface SummaryParams {
    start: string;
    end: string;
}
export const summary = async (params: SummaryParams, options?: RequestInit): Promise<{
    data: SummaryOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params.start != null) searchParams.set("start", String(params.start));
    if (params.end != null) searchParams.set("end", String(params.end));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/summary?${queryString}` : "/api/summary";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const summaryKey = (params?: SummaryParams)=>{
    return [
        "/api/summary",
        params
    ] as const;
};
export function useSummary<TData = {
    data: SummaryOut;
}>(options: {
    params: SummaryParams;
    query?: Omit<UseQueryOptions<{
        data: SummaryOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: summaryKey(options.params),
        queryFn: ()=>summary(options.params),
        ...options?.query
    });
}
export function useSummarySuspense<TData = {
    data: SummaryOut;
}>(options: {
    params: SummaryParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: SummaryOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: summaryKey(options.params),
        queryFn: ()=>summary(options.params),
        ...options?.query
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
