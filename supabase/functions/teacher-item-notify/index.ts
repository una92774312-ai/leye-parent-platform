import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-teacher-notify-secret",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const LINE_CHANNEL_ACCESS_TOKEN =
  Deno.env.get("TEACHER_LINE_CHANNEL_ACCESS_TOKEN")
  ||
  "";

const TEACHER_LIFF_URL =
  Deno.env.get("TEACHER_LIFF_URL")
  ||
  "https://liff.line.me/2011987947-mIbgSMNU";

const LOGO_URL =
  "https://una92774312-ai.github.io/leye-parent-platform/leye-logo.png";

function jsonResponse(body: unknown,status=200){
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

function formatDate(value: unknown){
  if(!value) return "-";
  return String(value).replaceAll("-"," / ");
}

function getTaiwanDateString(){
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:"Asia/Taipei",
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
      }
    ).formatToParts(new Date());

  const map:any = {};
  for(const part of parts){
    if(part.type !== "literal"){
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day}`;
}

function formatClock(value: unknown){
  if(!value) return "-";
  return String(value).slice(0,5);
}

function infoRow(label:string,value:string){
  return {
    type:"box",
    layout:"horizontal",
    margin:"md",
    contents:[
      {
        type:"text",
        text:label,
        size:"sm",
        color:"#8B9087",
        flex:3,
        wrap:true
      },
      {
        type:"text",
        text:value || "-",
        size:"sm",
        color:"#3F4D40",
        weight:"bold",
        flex:7,
        wrap:true
      }
    ]
  };
}

function buildTeacherMessage(item:any){
  const adminReview = item.adminReview === true;
  const typeLabel =
    item.notificationType === "leave"
      ? "請假通知"
      : item.notificationType === "temporary"
        ? "臨時托育"
        : item.notificationType === "extended"
          ? "延長托育"
          : item.notificationType === "early_pickup"
            ? "提早接送"
            : "晚到通知";

  const emoji =
    item.notificationType === "leave"
      ? "📝"
      : item.notificationType === "temporary"
        ? "🟣"
        : item.notificationType === "extended"
          ? "🟢"
          : item.notificationType === "early_pickup"
            ? "☀️"
            : "🟠";

  const isCare =
    ["temporary","extended"].includes(
      item.notificationType
    );

  const bodyContents:any[] = [
    {
      type:"box",
      layout:"horizontal",
      alignItems:"center",
      contents:[
        {
          type:"image",
          url:LOGO_URL,
          size:"sm",
          aspectMode:"fit",
          flex:2
        },
        {
          type:"box",
          layout:"vertical",
          flex:8,
          margin:"md",
          contents:[
            {
              type:"text",
              text:"樂業附幼",
              weight:"bold",
              size:"lg",
              color:"#52644E"
            },
            {
              type:"text",
              text:adminReview ? "行政審核提醒" : isCare ? "托育安排通知"
                : "家長新通知",
              size:"xs",
              color:"#858A81",
              margin:"xs"
            }
          ]
        }
      ]
    },
    {
      type:"separator",
      margin:"lg",
      color:"#E8E3D8"
    },
    {
      type:"text",
      text:adminReview ? `📋 待審核｜${typeLabel}` : item.notificationType==="leave"&&item.status==="cancelled" ? "↩ 請假已取消" : `${emoji} ${typeLabel}`,
      weight:"bold",
      size:"xl",
      color:"#40513D",
      margin:"lg"
    },
    {
      type:"text",
      text:adminReview ? "新申請待行政審核，請開啟後台。" : isCare
        ? (
            item.status === "approved"
              ? "行政已完成安排，請留意今日幼兒托育動向。"
              : "家長已送出托育申請，原班老師可先掌握資訊。"
          )
        : item.notificationType==="leave"&&item.status==="cancelled" ? "家長已取消該日請假，請留意幼兒當日出缺席與課後安排。" : "家長有新的幼兒事項，請開啟教職員平台確認。",
      size:"sm",
      color:"#6B7168",
      wrap:true,
      margin:"sm"
    },
    infoRow("👶 幼兒",item.childDisplay),
    infoRow("🏫 原班級",item.className),
    infoRow("📅 日期",formatDate(item.itemDate))
  ];

  if(item.notificationType === "leave"){
    bodyContents.push(
      infoRow("📝 原因",item.reason || "未填寫")
    );
  }

  if(isCare){
    bodyContents.push(
      infoRow(
        "⏰ 時段",
        [
          formatClock(item.requestedStartTime),
          formatClock(item.requestedEndTime)
        ]
          .filter(v=>v && v!=="-")
          .join(" ～ ")
        || "-"
      ),
      infoRow(
        "📌 狀態",
        item.status === "approved"
          ? "已核准"
          : item.status === "waitlist"
            ? "候補"
            : "待行政處理"
      )
    );

    if(item.assignedAftercareClass){
      bodyContents.push(
        infoRow(
          "🏠 安排課後班",
          item.assignedAftercareClass
        )
      );
    }

    if(item.reason){
      bodyContents.push(
        infoRow("📝 原因",item.reason)
      );
    }
  }

  if(item.notificationType === "early_pickup"){
    bodyContents.push(
      infoRow(
        "⏰ 預計接送",
        formatClock(
          item.expectedArrivalTime
          || item.scheduledPickupTime
        )
      ),
      infoRow(
        "👤 接送人員",
        item.pickupPerson || "-"
      )
    );

    if(item.reason){
      bodyContents.push(
        infoRow("📝 原因",item.reason)
      );
    }
  }

  if(item.notificationType === "late_notice"){
    bodyContents.push(
      infoRow(
        "⏰ 原訂接回",
        formatClock(item.scheduledPickupTime)
      ),
      infoRow(
        "🚗 預計抵達",
        formatClock(item.expectedArrivalTime)
      ),
      infoRow(
        "👤 接送人員",
        item.pickupPerson || "-"
      )
    );

    if(item.reason){
      bodyContents.push(
        infoRow("📝 原因",item.reason)
      );
    }
  }

  return {
    type:"flex",
    altText:`樂業附幼｜${typeLabel}｜${item.childDisplay}`,
    contents:{
      type:"bubble",
      body:{
        type:"box",
        layout:"vertical",
        backgroundColor:"#FFFEFA",
        paddingAll:"18px",
        contents:bodyContents
      },
      footer:{
        type:"box",
        layout:"vertical",
        backgroundColor:"#F4F1E8",
        paddingAll:"12px",
        contents:[
          {
            type:"button",
            style:"primary",
            color:"#819B73",
            height:"sm",
            action:{
              type:"uri",
              label:adminReview ? "前往行政審核" : "開啟教職員平台",
              uri:adminReview ? "https://una92774312-ai.github.io/leye-parent-platform/admin.html" : TEACHER_LIFF_URL
            }
          }
        ]
      }
    }
  };
}

async function authorized(req:Request,admin:any){
  const secret =
    req.headers.get("x-teacher-notify-secret") || "";

  if(!secret) return false;

  const {data,error} =
    await admin.rpc(
      "verify_teacher_item_notify_secret",
      {p_secret:secret}
    );

  return !error && data === true;
}

async function getSourceItem(
  admin:any,
  sourceType:string,
  sourceId:string
){
  if(sourceType === "request"){
    const {data:r,error} =
      await admin
        .from("requests")
        .select(
          "id,request_date,child_id,request_type,status,reason,note,requested_start_time,requested_end_time,scheduled_pickup_time,expected_arrival_time,assigned_aftercare_class_code,assigned_aftercare_class_id,notice_time,created_at,updated_at"
        )
        .eq("id",sourceId)
        .maybeSingle();

    if(error || !r){
      throw new Error("REQUEST_NOT_FOUND");
    }

    if(
      String(r.request_date || "") <
      getTaiwanDateString()
    ){
      return null;
    }

    if(
      ![
        "leave",
        "pickup_early",
        "temporary",
        "extended"
      ].includes(r.request_type)
    ){
      return null;
    }

    if(
      ["temporary","extended"].includes(
        r.request_type
      )
    ){
      if(
        !["pending","waitlist","approved"].includes(
          r.status
        )
      ){
        return null;
      }
    }
    else if(
      !(r.request_type==="leave" ? ["submitted","pending","approved","cancelled"].includes(r.status) : ["submitted","pending","approved"].includes(r.status))
    ){
      return null;
    }

    const assignedClassId =
      r.assigned_aftercare_class_code
      || r.assigned_aftercare_class_id
      || "";

    if(
      ["temporary","extended"].includes(
        r.request_type
      )
      &&
      r.status === "approved"
      &&
      !assignedClassId
    ){
      return null;
    }

    let assignedClassName = "";

    if(assignedClassId){
      const {data:ac} =
        await admin
          .from("aftercare_classes")
          .select("name")
          .eq("id",assignedClassId)
          .maybeSingle();

      assignedClassName =
        ac?.name
        ? String(ac.name)
        : String(assignedClassId);
    }

    return {
      childId:r.child_id,
      itemDate:r.request_date,
      notificationType:r.request_type,
      status:r.status,
      reason:r.reason || r.note || "",
      scheduledPickupTime:r.scheduled_pickup_time,
      expectedArrivalTime:
        r.expected_arrival_time
        || r.requested_start_time,
      requestedStartTime:r.requested_start_time,
      requestedEndTime:r.requested_end_time,
      pickupPerson:"",
      assignedAftercareClassId:
        String(assignedClassId || ""),
      assignedAftercareClass:
        assignedClassName,
      eventKey:
        ["temporary","extended"].includes(
          r.request_type
        )
          ? [
              r.id,
              r.status,
              assignedClassId || "-"
            ].join("|")
          : r.request_type==="leave" && r.status==="cancelled"
            ? [r.id,"cancelled"].join("|")
            : String(r.notice_time || r.created_at || r.id)
    };
  }

  if(sourceType === "pickup"){
    const {data:p,error} =
      await admin
        .from("pickup_records")
        .select(
          "id,pickup_date,child_id,pickup_mode,pickup_person,scheduled_pickup_time,expected_arrival_time,notice_reason,guardian_notice_at,updated_at,actual_pickup_at"
        )
        .eq("id",sourceId)
        .maybeSingle();

    if(error || !p){
      throw new Error("PICKUP_NOT_FOUND");
    }

    if(
      String(p.pickup_date || "") <
      getTaiwanDateString()
    ){
      return null;
    }

    if(p.actual_pickup_at){
      return null;
    }

    if(
      !["early","late_notice"].includes(
        p.pickup_mode
      )
    ){
      return null;
    }

    return {
      childId:p.child_id,
      itemDate:p.pickup_date,
      notificationType:
        p.pickup_mode === "early"
          ? "early_pickup"
          : "late_notice",
      reason:p.notice_reason || "",
      scheduledPickupTime:p.scheduled_pickup_time,
      expectedArrivalTime:p.expected_arrival_time,
      pickupPerson:p.pickup_person || "",
      eventKey:String(
        p.guardian_notice_at
        || p.updated_at
        || p.id
      )
    };
  }

  return null;
}

async function getCandidateStaffIds(
  admin:any,
  child:any,
  itemDate:string,
  notificationType:string,
  assignedAftercareClassId:string
){
  const morningIds = new Set<string>();

  const {data:morningAssignments,error:morningError} =
    await admin
      .from("staff_assignments")
      .select("staff_id")
      .eq("active",true)
      .eq(
        "morning_class_id",
        child.morning_class_id
      )
      .is("assignment_date",null);

  if(morningError) throw morningError;

  for(const row of morningAssignments || []){
    if(row.staff_id){
      morningIds.add(
        String(row.staff_id)
      );
    }
  }

  const {data:specialAccess,error:specialError} =
    await admin
      .from("staff_class_access")
      .select("staff_id")
      .eq("active",true)
      .eq(
        "morning_class_id",
        child.morning_class_id
      );

  if(specialError) throw specialError;

  for(const row of specialAccess || []){
    if(row.staff_id){
      morningIds.add(
        String(row.staff_id)
      );
    }
  }

  async function aftercareIdsFor(
    classId:string
  ){
    if(!classId){
      return [];
    }

    const {data:datedStaff,error:datedError} =
      await admin
        .from("staff_assignments")
        .select("staff_id")
        .eq("active",true)
        .eq("assignment_date",itemDate)
        .eq("aftercare_class_id",classId);

    if(datedError) throw datedError;

    if((datedStaff || []).length){
      return [
        ...new Set(
          (datedStaff || [])
            .map((row:any)=>row.staff_id)
            .filter(Boolean)
            .map(String)
        )
      ];
    }

    const {data:fixedStaff,error:fixedError} =
      await admin
        .from("staff_assignments")
        .select("staff_id")
        .eq("active",true)
        .is("assignment_date",null)
        .eq("aftercare_class_id",classId);

    if(fixedError) throw fixedError;

    const {data:excluded,error:exclusionError} = await admin
      .from("aftercare_staff_day_exclusions")
      .select("staff_id")
      .eq("assignment_date",itemDate)
      .eq("aftercare_class_id",classId);
    if(exclusionError) throw exclusionError;
    const excludedStaffIds = new Set((excluded || []).map((r:any)=>String(r.staff_id)));

    return [
      ...new Set(
        (fixedStaff || [])
          .map((row:any)=>row.staff_id)
          .filter(Boolean)
          .map(String)
          .filter((id:string)=>!excludedStaffIds.has(id))
      )
    ];
  }

  // 臨托／延托：
  // 原班導師一併知道；行政安排課後班後，
  // 被安排的課後班老師也收到通知。
  if(
    ["temporary","extended"].includes(
      notificationType
    )
  ){
    const ids =
      new Set<string>(morningIds);

    for(
      const id of await aftercareIdsFor(
        assignedAftercareClassId
      )
    ){
      ids.add(id);
    }

    return [...ids];
  }

  let aftercareClassId = "";

  const {data:dayAssignments,error:dayError} =
    await admin
      .from("aftercare_assignments")
      .select(
        "aftercare_class_id,assignment_status"
      )
      .eq("child_id",child.id)
      .eq("assignment_date",itemDate)
      .in(
        "assignment_status",
        ["pending","assigned","active","completed"]
      )
      .not("aftercare_class_id","is",null)
      .limit(1);

  if(dayError) throw dayError;

  if(
    dayAssignments?.[0]?.aftercare_class_id
  ){
    aftercareClassId =
      String(
        dayAssignments[0].aftercare_class_id
      );
  }

  if(!aftercareClassId){
    const {data:plans,error:planError} =
      await admin
        .from("aftercare_plans")
        .select(
          "default_aftercare_class_id,start_date,end_date"
        )
        .eq("child_id",child.id)
        .eq("active",true)
        .lte("start_date",itemDate)
        .or(
          `end_date.is.null,end_date.gte.${itemDate}`
        )
        .not(
          "default_aftercare_class_id",
          "is",
          null
        )
        .limit(1);

    if(planError) throw planError;

    if(
      plans?.[0]?.default_aftercare_class_id
    ){
      aftercareClassId =
        String(
          plans[0].default_aftercare_class_id
        );
    }
  }

  // 請假：
  // 原班導師一定收到；
  // 若幼兒當日有課後班，課後老師也一併收到，
  // 避免課後班仍等待未到園幼兒。
  if(notificationType === "leave"){
    const ids =
      new Set<string>(morningIds);

    for(
      const id of await aftercareIdsFor(
        aftercareClassId
      )
    ){
      ids.add(id);
    }

    return [...ids];
  }

  // 接送：
  // 沒有課後班 → 原班導師；
  // 有課後班 → 當日課後班老師。
  if(!aftercareClassId){
    return [...morningIds];
  }

  return await aftercareIdsFor(
    aftercareClassId
  );
}

async function upsertNotificationLog(
  admin:any,
  args:any
){
  const match = {
    source_type:args.sourceType,
    source_id:args.sourceId,
    staff_id:args.staffId,
    event_key:args.eventKey
  };

  const {data:existing,error:existingError} =
    await admin
      .from("teacher_line_notifications")
      .select("id,status")
      .match(match)
      .maybeSingle();

  if(existingError) throw existingError;

  if(existing?.status === "sent"){
    return {
      id:existing.id,
      alreadySent:true
    };
  }

  if(existing?.id){
    const {error:updateError} =
      await admin
        .from("teacher_line_notifications")
        .update({
          notification_type:args.notificationType,
          status:"pending",
          last_error:null,
          updated_at:new Date().toISOString()
        })
        .eq("id",existing.id);

    if(updateError) throw updateError;

    return {
      id:existing.id,
      alreadySent:false
    };
  }

  const {data:inserted,error:insertError} =
    await admin
      .from("teacher_line_notifications")
      .insert({
        ...match,
        notification_type:args.notificationType,
        status:"pending"
      })
      .select("id")
      .single();

  if(insertError){
    if(insertError.code === "23505"){
      const {data:raceRow} =
        await admin
          .from("teacher_line_notifications")
          .select("id,status")
          .match(match)
          .maybeSingle();

      return {
        id:raceRow?.id || "",
        alreadySent:raceRow?.status === "sent"
      };
    }

    throw insertError;
  }

  return {
    id:inserted.id,
    alreadySent:false
  };
}

Deno.serve(async(req) => {
  if(req.method === "OPTIONS"){
    return new Response("ok",{headers:corsHeaders});
  }

  if(req.method !== "POST"){
    return jsonResponse(
      {error:"METHOD_NOT_ALLOWED"},
      405
    );
  }

  try{
    if(
      !SUPABASE_URL
      ||
      !SUPABASE_SERVICE_ROLE_KEY
      ||
      !LINE_CHANNEL_ACCESS_TOKEN
    ){
      throw new Error("SERVER_CONFIGURATION_ERROR");
    }

    const admin =
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

    if(
      !(await authorized(req,admin))
    ){
      return jsonResponse(
        {error:"UNAUTHORIZED"},
        401
      );
    }

    const body =
      await req.json().catch(() => ({}));

    const sourceType =
      String(body?.sourceType || "");

    const sourceId =
      String(body?.sourceId || "");

    if(
      !["request","pickup"].includes(sourceType)
      ||
      !sourceId
    ){
      return jsonResponse(
        {
          error:"INVALID_SOURCE",
          message:"缺少通知來源。"
        },
        400
      );
    }

    const item =
      await getSourceItem(
        admin,
        sourceType,
        sourceId
      );

    if(!item){
      return jsonResponse({
        ok:true,
        skipped:true,
        reason:"source_not_notifiable"
      });
    }

    const {data:child,error:childError} =
      await admin
        .from("children")
        .select("id,name,seat_no,morning_class_id,active")
        .eq("id",item.childId)
        .maybeSingle();

    if(
      childError
      ||
      !child
      ||
      child.active !== true
    ){
      throw new Error("CHILD_NOT_FOUND");
    }

    const {data:morningClass} =
      await admin
        .from("classes")
        .select("name")
        .eq("id",child.morning_class_id)
        .maybeSingle();

    const candidateStaffIds =
      await getCandidateStaffIds(
        admin,
        child,
        item.itemDate,
        item.notificationType,
        item.assignedAftercareClassId || ""
      );

    if(!candidateStaffIds.length && !(sourceType === "request" && item.status === "pending" && ["temporary","extended"].includes(item.notificationType))){
      return jsonResponse({
        ok:true,
        sent:0,
        candidates:0,
        skipped:0,
        reason:"no_teacher_assignment"
      });
    }

    const {data:staffRows,error:staffError} =
      await admin
        .from("staff")
        .select("id,display_name,role,line_user_id,active")
        .in("id",candidateStaffIds)
        .eq("active",true)
        .in("role",["class_teacher","aftercare_teacher"]);

    if(staffError) throw staffError;

    const isNewReview = sourceType === "request" && item.status === "pending"
      && ["temporary","extended"].includes(item.notificationType);
    let admins:any[] = [];
    if(isNewReview){
      const {data:rows,error:e} = await admin.from("staff")
        .select("id,display_name,role,line_user_id,active")
        .eq("active",true).eq("role","admin")
        .in("display_name",["蔡青蓓","蔡妤瑄"]);
      if(e) throw e;
      admins = rows || [];
    }
    const recipients:any[] = [...(staffRows || [])];
    for(const reviewer of admins){
      if(!recipients.some(r=>r.id===reviewer.id)) recipients.push(reviewer);
    }

    const childDisplay =
      child.seat_no
        ? `${child.seat_no}號 ${child.name}`
        : String(child.name || "幼兒");

    const regularMessage =
      buildTeacherMessage({
        ...item,
        childDisplay,
        className:
          morningClass?.name
          || child.morning_class_id
          || "未設定"
      });

    const reviewMessage = isNewReview ? buildTeacherMessage({
      ...item,childDisplay,className:morningClass?.name || child.morning_class_id || "未設定",adminReview:true
    }) : null;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for(const staff of recipients){
      const log =
        await upsertNotificationLog(
          admin,
          {
            sourceType,
            sourceId,
            staffId:staff.id,
            eventKey:item.eventKey,
            notificationType:item.notificationType
          }
        );

      if(log.alreadySent){
        skipped += 1;
        continue;
      }

      if(!staff.line_user_id){
        await admin
          .from("teacher_line_notifications")
          .update({
            status:"skipped",
            last_error:"teacher_line_not_bound",
            updated_at:new Date().toISOString()
          })
          .eq("id",log.id);

        skipped += 1;
        continue;
      }

      const lineResponse =
        await fetch(
          "https://api.line.me/v2/bot/message/push",
          {
            method:"POST",
            headers:{
              "Content-Type":"application/json",
              "Authorization":
                "Bearer "
                + LINE_CHANNEL_ACCESS_TOKEN
            },
            body:JSON.stringify({
              to:staff.line_user_id,
              messages:[isNewReview && staff.role === "admin" ? reviewMessage : regularMessage]
            })
          }
        );

      const lineText =
        await lineResponse.text();

      if(lineResponse.ok){
        await admin
          .from("teacher_line_notifications")
          .update({
            status:"sent",
            sent_at:new Date().toISOString(),
            last_error:null,
            updated_at:new Date().toISOString()
          })
          .eq("id",log.id);

        sent += 1;
      }
      else{
        await admin
          .from("teacher_line_notifications")
          .update({
            status:"failed",
            last_error:
              `LINE ${lineResponse.status}: ${lineText}`.slice(0,2000),
            updated_at:new Date().toISOString()
          })
          .eq("id",log.id);

        failed += 1;
      }
    }

    return jsonResponse({
      ok:true,
      sourceType,
      sourceId,
      notificationType:item.notificationType,
      candidates:recipients.length,
      sent,
      skipped,
      failed
    });
  }
  catch(error){
    console.error("teacher-item-notify error:",error);

    return jsonResponse(
      {
        error:"TEACHER_NOTIFY_FAILED",
        message:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    );
  }
});
