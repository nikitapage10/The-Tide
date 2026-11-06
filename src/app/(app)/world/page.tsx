import { redirect } from "next/navigation";
import type { SearchParams } from "@/lib/server/params";
export default async function Page({searchParams}:{searchParams:SearchParams}) {
 const query = new URLSearchParams({view:"all"});
 for(const [key,value] of Object.entries(await searchParams)) if(typeof value === "string") query.set(key,value);
 redirect("/codex?"+query.toString());
}
