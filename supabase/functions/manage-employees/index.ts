import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: req.headers.get("Authorization")! } },
        });
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "No autorizado: sesion no valida" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const { action, ...payload } = body;
        console.log(`manage-employees: action="${action}", userId=${user.id}`);

        const { data: adminProfile } = await supabaseAdmin
            .from("profiles")
            .select("store_id, role")
            .eq("id", user.id)
            .single();

        let currentStoreId = adminProfile?.store_id;
        if (!currentStoreId) {
            const { data: stores } = await supabaseAdmin.from("stores").select("id").limit(1);
            if (stores && stores.length > 0) currentStoreId = stores[0].id;
        }

        // ── CREATE ──────────────────────────────────────────────────────────
        if (action === "create") {
            const { email, password, fullName, role, cedula } = payload;
            let userId: string;

            if (!currentStoreId) throw new Error("No tienes un comercio asociado. Crea uno primero.");

            const { data: existingProfile } = await supabaseAdmin
                .from("profiles").select("id, store_id").eq("email", email).maybeSingle();

            if (existingProfile) {
                userId = existingProfile.id;
                if (existingProfile.store_id && existingProfile.store_id !== currentStoreId) {
                    throw new Error("Este correo ya esta registrado en otro comercio.");
                }
            } else {
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email, password, email_confirm: true,
                    user_metadata: { full_name: fullName },
                });
                if (createError) {
                    if (createError.message?.toLowerCase().includes("already registered") ||
                        createError.message?.toLowerCase().includes("already exists")) {
                        throw new Error("El usuario ya existe en Auth pero no tiene perfil. Contacte soporte.");
                    }
                    throw createError;
                }
                if (!newUser.user) throw new Error("Error al crear usuario en Auth.");
                userId = newUser.user.id;
            }

            const dbRole = role || "staff";
            const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
                { id: userId, email, full_name: fullName, role: dbRole, store_id: currentStoreId, is_active: true, cedula },
                { onConflict: "id" }
            );
            if (profileError) {
                if (!existingProfile) await supabaseAdmin.auth.admin.deleteUser(userId);
                throw profileError;
            }

            try {
                await supabaseAdmin.from("user_roles").upsert(
                    { user_id: userId, role: dbRole === "admin" ? "admin" : "staff" },
                    { onConflict: "user_id" }
                );
            } catch (e: any) { console.log("user_roles table skipped:", e.message); }

            return new Response(JSON.stringify({ success: true, userId }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── UPDATE ──────────────────────────────────────────────────────────
        else if (action === "update") {
            const { id, email, password, fullName, role, is_active, cedula } = payload;

            const { data: targetProfile, error: fetchError } = await supabaseAdmin
                .from("profiles").select("store_id, email").eq("id", id).single();
            if (fetchError || !targetProfile) throw new Error("Empleado no encontrado.");

            const isSelfUpdate = id === user.id;
            const storeMismatch = targetProfile.store_id && currentStoreId && targetProfile.store_id !== currentStoreId;
            if (!isSelfUpdate && storeMismatch) throw new Error("No tienes permiso para editar este empleado.");

            const updateData: any = { full_name: fullName, role, email };
            if (typeof is_active === "boolean") updateData.is_active = is_active;
            if (cedula !== undefined) updateData.cedula = cedula;

            const { error: profileError } = await supabaseAdmin.from("profiles").update(updateData).eq("id", id);
            if (profileError) {
                if (profileError.message.includes("is_active") || profileError.code === "42703") {
                    const { error: retryError } = await supabaseAdmin
                        .from("profiles").update({ full_name: fullName, role, email, cedula }).eq("id", id);
                    if (retryError) throw retryError;
                } else {
                    throw profileError;
                }
            }

            const authUpdates: any = {};
            if (email && email.toLowerCase() !== targetProfile.email?.toLowerCase()) authUpdates.email = email;
            if (password && password.length >= 6) authUpdates.password = password;
            if (Object.keys(authUpdates).length > 0) {
                const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
                if (authUpdateError) throw authUpdateError;
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── TOGGLE STATUS ────────────────────────────────────────────────────
        else if (action === "toggle_status") {
            const { id, isActive } = payload;
            if (!id) throw new Error("ID de empleado requerido.");

            const { data: targetProfile, error: fetchError } = await supabaseAdmin
                .from("profiles").select("store_id").eq("id", id).single();
            if (fetchError || !targetProfile) throw new Error("Empleado no encontrado.");

            const storeMismatch = targetProfile.store_id && currentStoreId && targetProfile.store_id !== currentStoreId;
            if (storeMismatch) throw new Error("No tienes permiso para modificar este empleado.");

            const { error: updateError } = await supabaseAdmin
                .from("profiles").update({ is_active: isActive }).eq("id", id);
            if (updateError) console.warn("toggle_status update error:", updateError.message);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── DELETE ──────────────────────────────────────────────────────────
        else if (action === "delete") {
            const { id } = payload;
            if (!id) throw new Error("ID de empleado requerido.");
            if (id === user.id) throw new Error("No puedes eliminarte a ti mismo.");

            const { data: targetProfile, error: fetchError } = await supabaseAdmin
                .from("profiles").select("store_id").eq("id", id).single();
            if (fetchError || !targetProfile) throw new Error("Empleado no encontrado.");

            if (currentStoreId && targetProfile.store_id && targetProfile.store_id !== currentStoreId) {
                throw new Error("No tienes permiso para eliminar este empleado.");
            }

            // Limpiar TODAS las FK (NO ACTION) antes de eliminar
            // Tablas encontradas via SQL introspection sobre information_schema

            // 1. cash_movements.profile_id
            try {
                await supabaseAdmin.from("cash_movements").update({ profile_id: null }).eq("profile_id", id);
            } catch (e: any) { console.warn("fk_cleanup cash_movements:", e.message); }

            // 2. cash_sessions.opened_by y .closed_by
            try {
                await supabaseAdmin.from("cash_sessions").update({ opened_by: null }).eq("opened_by", id);
            } catch (e: any) { console.warn("fk_cleanup cash_sessions opened_by:", e.message); }
            try {
                await supabaseAdmin.from("cash_sessions").update({ closed_by: null }).eq("closed_by", id);
            } catch (e: any) { console.warn("fk_cleanup cash_sessions closed_by:", e.message); }

            // 3. daily_closings.profile_id
            try {
                await supabaseAdmin.from("daily_closings").update({ profile_id: null }).eq("profile_id", id);
            } catch (e: any) { console.warn("fk_cleanup daily_closings:", e.message); }

            // 4. open_orders.profile_id
            try {
                await supabaseAdmin.from("open_orders").update({ profile_id: null }).eq("profile_id", id);
            } catch (e: any) { console.warn("fk_cleanup open_orders profile_id:", e.message); }

            // 5. sales.profile_id
            try {
                await supabaseAdmin.from("sales").update({ profile_id: null }).eq("profile_id", id);
            } catch (e: any) { console.warn("fk_cleanup sales:", e.message); }

            // 6. payroll_items.profile_id (ya SET NULL en DB, por si acaso)
            try {
                await supabaseAdmin.from("payroll_items").update({ profile_id: null }).eq("profile_id", id);
            } catch (e: any) { console.warn("fk_cleanup payroll_items:", e.message); }

            // 7. Tablas de nomina personalizadas
            try {
                await supabaseAdmin.from("employee_payrolls").delete().eq("employee_id", id);
            } catch (e: any) { console.warn("fk_cleanup employee_payrolls:", e.message); }
            try {
                await supabaseAdmin.from("employee_deductions").delete().eq("employee_id", id);
            } catch (e: any) { console.warn("fk_cleanup employee_deductions:", e.message); }

            // Eliminar el usuario de Auth (cascade a profiles via trigger)
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
            if (deleteError) {
                console.error("Auth delete error, trying profile delete directly:", deleteError.message);
                const { error: profileDeleteError } = await supabaseAdmin
                    .from("profiles").delete().eq("id", id);
                if (profileDeleteError) throw profileDeleteError;
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── UNKNOWN ──────────────────────────────────────────────────────────
        console.error(`manage-employees: accion desconocida: "${action}"`);
        throw new Error(`Accion no reconocida: "${action}". Las validas son: create, update, toggle_status, delete.`);

    } catch (error: any) {
        console.error("Function error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
