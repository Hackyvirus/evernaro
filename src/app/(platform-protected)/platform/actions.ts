"use server";

import { revalidatePath } from "next/cache";

export async function refreshClients() {
  revalidatePath("/platform");
  revalidatePath("/platform/billing");
}
