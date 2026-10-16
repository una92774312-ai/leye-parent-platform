import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://una92774312-ai.github.io",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const LINE_LOGIN_CHANNEL_ID =
  "2011537895";

function jsonResponse(body: unknown, status = 200){
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers:{
        ...corsHeaders,
        "Content-Type":"application/json; charset=utf-8"
      }
    }
  );
}

async function verifyLineIdToken(idToken: string){
  const form = new URLSearchParams();
  form.set("id_token", idToken);
  form.set("client_id", LINE_LOGIN_CHANNEL_ID);

  const response = await fetch(
    "https://api.line.me/oauth2/v2.1/verify",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded"
      },
      body:form.toString()
    }
  );

  const result = await response.json().catch(() => ({}));

  if(
    !response.ok
    ||
    !result?.sub
    ||
    String(result.aud || "") !== LINE_LOGIN_CHANNEL_ID
  ){
    throw new Error("INVALID_LINE_TOKEN");
  }

  return {
    lineUserId:String(result.sub),
    displayName:
      typeof result.name === "string"
      && result.name.trim()
        ? result.name.trim()
        : "LINE 使用者"
  };
}

async function sha256Hex(value: string){
  const bytes =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array
    .from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2,"0"))
    .join("");
}

async function bindingAttemptHash(
  flow: string,
  lineUserId: string
){
  return await sha256Hex(
    flow + ":" + lineUserId
  );
}

async function beginBindingAttempt(
  adminClient: any,
  flow: "parent" | "teacher",
  lineUserId: string
){
  const subjectHash =
    await bindingAttemptHash(
      flow,
      lineUserId
    );

  const cutoff =
    new Date(
      Date.now() - 15 * 60 * 1000
    ).toISOString();

  const {
    count,
    error:countError
  } =
    await adminClient
      .from("line_binding_attempts")
      .select("id",{
        count:"exact",
        head:true
      })
      .eq("flow",flow)
      .eq("subject_hash",subjectHash)
      .gte("attempted_at",cutoff);

  if(countError){
    throw countError;
  }

  if((count || 0) >= 8){
    return {
      blocked:true,
      attemptId:""
    };
  }

  const {
    data:attempt,
    error:attemptError
  } =
    await adminClient
      .from("line_binding_attempts")
      .insert({
        flow,
        subject_hash:subjectHash,
        success:false
      })
      .select("id")
      .single();

  if(attemptError){
    throw attemptError;
  }

  return {
    blocked:false,
    attemptId:String(attempt.id)
  };
}

async function guardianIsPilotEligible(
  adminClient: any,
  guardianId: string
){
  const {data:setting} =
    await adminClient
      .from("settings")
      .select("setting_value")
      .eq("setting_key","pilot_rollout")
      .maybeSingle();

  const cfg =
    setting?.setting_value || {};

  if(cfg?.enabled !== true){
    return true;
  }

  const classIds =
    Array.isArray(cfg?.class_ids)
      ? cfg.class_ids.map(String)
      : [];

  const {data:links,error:linkError} =
    await adminClient
      .from("guardian_children")
      .select("child_id")
      .eq("guardian_id",guardianId)
      .eq("active",true);

  if(linkError){
    throw linkError;
  }

  const childIds =
    (links || [])
      .map((x:any) => x.child_id)
      .filter(Boolean);

  if(!childIds.length){
    return false;
  }

  const {data:children,error:childError} =
    await adminClient
      .from("children")
      .select("id,morning_class_id,school_code,active")
      .in("id",childIds)
      .eq("active",true);

  if(childError){
    throw childError;
  }

  return (children || []).some((child:any) => {
    const isTest =
      String(child.school_code || "")
        .startsWith("TEST");

    const isPilotClass =
      classIds.includes(
        String(child.morning_class_id || "")
      );

    return isTest || isPilotClass;
  });
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS"){
    return new Response("ok",{headers:corsHeaders});
  }

  if(req.method !== "POST"){
    return jsonResponse(
      {error:"METHOD_NOT_ALLOWED",message:"不支援此請求方式。"},
      405
    );
  }

  try{
    if(
      !SUPABASE_URL
      ||
      !SUPABASE_SERVICE_ROLE_KEY
    ){
      throw new Error("SERVER_CONFIGURATION_ERROR");
    }

    const body =
      await req.json().catch(() => ({}));

    const idToken =
      String(body?.idToken || "").trim();

    const bindingCode =
      String(body?.bindingCode || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g,"");

    if(!idToken || !bindingCode){
      return jsonResponse(
        {
          error:"MISSING_REQUIRED_FIELDS",
          message:"請輸入家庭綁定碼後再試一次。"
        },
        400
      );
    }

    if(bindingCode.length !== 16){
      return jsonResponse(
        {
          error:"INVALID_BINDING_CODE",
          message:"家庭綁定碼格式不正確。"
        },
        400
      );
    }

    let lineIdentity;
    try{
      lineIdentity =
        await verifyLineIdToken(idToken);
    }
    catch(_){
      return jsonResponse(
        {
          error:"INVALID_LINE_TOKEN",
          message:"LINE 身分驗證失敗，請重新開啟家長平台。"
        },
        401
      );
    }

    const adminClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth:{
            persistSession:false,
            autoRefreshToken:false
          }
        }
      );

    const rate =
      await beginBindingAttempt(
        adminClient,
        "parent",
        lineIdentity.lineUserId
      );

    if(rate.blocked){
      return jsonResponse(
        {
          error:"TOO_MANY_ATTEMPTS",
          message:"嘗試次數過多，請稍後再試或聯絡本園。"
        },
        429
      );
    }

    const codeHash =
      await sha256Hex(bindingCode);

    const {
      data:codeRow,
      error:codeError
    } =
      await adminClient
        .from("guardian_line_binding_codes")
        .select("id,guardian_id,expires_at,used_at,used_by_line_user_id,active")
        .eq("code_hash",codeHash)
        .maybeSingle();

    if(codeError){
      console.error("binding code lookup:",codeError);
      throw new Error("BINDING_LOOKUP_FAILED");
    }

    if(
      !codeRow
      ||
      (codeRow.active !== true && !codeRow.used_at)
      ||
      (codeRow.used_at && String(codeRow.used_by_line_user_id || "") !== lineIdentity.lineUserId)
      ||
      new Date(codeRow.expires_at).getTime() <= Date.now()
    ){
      return jsonResponse(
        {
          error:"BINDING_CODE_INVALID_OR_EXPIRED",
          message:"家庭綁定碼無效或已過期，請向本園重新索取。"
        },
        400
      );
    }

    const guardianId =
      String(codeRow.guardian_id);

    const {
      data:guardian,
      error:guardianError
    } =
      await adminClient
        .from("guardians")
        .select("id,active,line_user_id")
        .eq("id",guardianId)
        .maybeSingle();

    if(
      guardianError
      ||
      !guardian
      ||
      guardian.active !== true
    ){
      return jsonResponse(
        {
          error:"GUARDIAN_INACTIVE",
          message:"此家長資料目前未啟用，請聯絡本園。"
        },
        403
      );
    }

    if(
      guardian.line_user_id
      &&
      String(guardian.line_user_id) !==
        lineIdentity.lineUserId
    ){
      return jsonResponse(
        {
          error:"GUARDIAN_ALREADY_BOUND",
          message:"此家長資料已綁定其他 LINE 帳號，如需更換請聯絡本園。"
        },
        409
      );
    }

    const eligible =
      await guardianIsPilotEligible(
        adminClient,
        guardianId
      );

    if(!eligible){
      return jsonResponse(
        {
          error:"PILOT_NOT_ENABLED",
          message:"目前試行僅開放櫻桃班與蘋果班。"
        },
        403
      );
    }

    const {
      data:lineGuardianRows,
      error:lineGuardianError
    } =
      await adminClient
        .from("user_identities")
        .select("auth_user_id,guardian_id")
        .eq("line_user_id",lineIdentity.lineUserId)
        .not("guardian_id","is",null);

    if(lineGuardianError){
      throw lineGuardianError;
    }

    const conflicting =
      (lineGuardianRows || [])
        .find(
          (row:any) =>
            String(row.guardian_id) !== guardianId
        );

    if(conflicting){
      return jsonResponse(
        {
          error:"LINE_ALREADY_BOUND",
          message:"此 LINE 帳號已綁定其他家長資料，請聯絡本園協助。"
        },
        409
      );
    }

    let {
      data:guardianIdentityRows,
      error:identityLookupError
    } =
      await adminClient
        .from("user_identities")
        .select("auth_user_id,guardian_id,line_user_id")
        .eq("guardian_id",guardianId)
        .limit(2);

    if(identityLookupError){
      throw identityLookupError;
    }

    if(
      guardianIdentityRows
      &&
      guardianIdentityRows.length > 1
    ){
      return jsonResponse(
        {
          error:"DUPLICATE_GUARDIAN_IDENTITY",
          message:"此家長資料存在重複登入身分，請聯絡本園處理。"
        },
        409
      );
    }

    const existingGuardianLine =
      guardianIdentityRows?.[0]?.line_user_id || "";

    if(
      existingGuardianLine
      &&
      String(existingGuardianLine) !==
        lineIdentity.lineUserId
    ){
      return jsonResponse(
        {
          error:"GUARDIAN_ALREADY_BOUND",
          message:"此家長資料已綁定其他 LINE 帳號，如需更換請聯絡本園。"
        },
        409
      );
    }

    // A code already claimed by this verified LINE account is recoverable.
    // Codes claimed by another LINE account are rejected above.
    if(!codeRow.used_at){
    const {
      data:claimed,
      error:claimError
    } =
      await adminClient.rpc(
        "consume_guardian_binding_code",
        {
          p_code_id:codeRow.id,
          p_guardian_id:guardianId,
          p_line_user_id:lineIdentity.lineUserId
        }
      );

    if(
      claimError
      ||
      claimed !== true
    ){
      return jsonResponse(
        {
          error:"BINDING_CODE_ALREADY_USED",
          message:"此綁定碼已被使用或失效，請向本園重新索取。"
        },
        409
      );
    }

    }

    let authUserId =
      guardianIdentityRows?.[0]?.auth_user_id || "";

    if(!authUserId){
      const randomPart =
        crypto.randomUUID().replaceAll("-","");

      const email =
        `guardian-${guardianId}-${randomPart.slice(0,8)}@parent.leye.local`;

      const password =
        crypto.randomUUID()
        +
        crypto.randomUUID();

      const {
        data:createData,
        error:createError
      } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm:true,
          user_metadata:{
            source:"line_parent_binding",
            guardian_id:guardianId
          }
        });

      if(
        createError
        ||
        !createData?.user?.id
      ){
        console.error("create parent auth user:",createError);
        throw new Error("CREATE_AUTH_USER_FAILED");
      }

      authUserId =
        createData.user.id;

      const {
        error:insertIdentityError
      } =
        await adminClient
          .from("user_identities")
          .insert({
            auth_user_id:authUserId,
            guardian_id:guardianId,
            staff_id:null,
            line_user_id:lineIdentity.lineUserId
          });

      if(insertIdentityError){
        await adminClient.auth.admin.deleteUser(authUserId);
        throw insertIdentityError;
      }
    }
    else{
      const {
        error:updateIdentityError
      } =
        await adminClient
          .from("user_identities")
          .update({
            line_user_id:lineIdentity.lineUserId
          })
          .eq("auth_user_id",authUserId);

      if(updateIdentityError){
        throw updateIdentityError;
      }
    }

    const {
      error:updateGuardianError
    } =
      await adminClient
        .from("guardians")
        .update({
          line_user_id:lineIdentity.lineUserId,
          updated_at:new Date().toISOString()
        })
        .eq("id",guardianId);

    if(updateGuardianError){
      throw updateGuardianError;
    }

    if(rate.attemptId){
      await adminClient
        .from("line_binding_attempts")
        .update({success:true})
        .eq("id",rate.attemptId);
    }

    return jsonResponse({
      ok:true,
      guardian_id:guardianId,
      lineDisplayName:lineIdentity.displayName,
      message:"家庭綁定完成。"
    });
  }
  catch(error){
    console.error("line-parent-bind error:",error);

    return jsonResponse(
      {
        error:"LINE_PARENT_BIND_FAILED",
        message:"家庭綁定失敗，請稍後再試或聯絡本園。"
      },
      500
    );
  }
});
