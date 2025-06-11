// // src/app/api/permissions/route.ts

// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions, ExtendedSession } from "@/lib/authOptions";
// import { getAllPermissions } from "@/app/services/roleService";
// import { hasPermission } from "@/lib/permissions";

// export async function GET(request: Request) {
//   const session = (await getServerSession(
//     authOptions
//   )) as ExtendedSession | null;
//   const user = session?.user;

//   if (!user?.id || !user?.companyId) {
//     return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
//   }

//   // Authorization: User must have permission to manage roles.
//   if (!hasPermission(user, "MANAGE", "ROLES")) {
//     return NextResponse.json(
//       { message: "Forbidden: You do not have permission to manage roles." },
//       { status: 403 }
//     );
//   }

//   try {
//     const permissions = await getAllPermissions();
//     return NextResponse.json(permissions);
//   } catch (error: any) {
//     console.error("API Error in GET /api/permissions:", error);
//     return NextResponse.json(
//       { message: error.message || "An unexpected error occurred" },
//       { status: 500 }
//     );
//   }
// }
