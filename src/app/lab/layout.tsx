import { requireGmPageContext } from "@/lib/server/page-context";
export const dynamic = "force-dynamic";
export default async function LabLayout({children}:{children:React.ReactNode}) {
 await requireGmPageContext(); return children;
}
