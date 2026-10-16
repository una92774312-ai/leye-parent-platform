import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};


const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";


const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";


const LINE_CHANNEL_ACCESS_TOKEN =
  Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";


const LOGO_URL =
  "https://una92774312-ai.github.io/leye-parent-platform/leye-logo.png";


const LIFF_REQUESTS_URL =
  "https://liff.line.me/2011537895-QkIp9Lh8?page=requests";


const AFTERCARE_CLASS_MAP = {
  AC01: "蝴蝶班",
  AC02: "白兔班",
  AC03: "蜜蜂班",
  AC04: "陽光書屋",
  AC05: "櫻桃班",
  AC06: "蘋果班"
};


const AFTERCARE_EXTENSIONS = { AC01:"#779", AC02:"#778", AC03:"#777", AC04:"#782", AC05:"#775", AC06:"#774" };

const CLASS_MAP = {
  C01: "櫻桃班",
  C02: "蘋果班",
  C03: "蝴蝶班",
  C04: "白兔班",
  C05: "蜜蜂班",
  C06: "袋鼠班",
  C07: "綿羊班",
  C08: "企鵝班"
};


const STATUS_UI = {

  approved: {
    label: "已核准",
    emoji: "✓",
    pillBg: "#DDE9D5",
    pillText: "#52644E",
    reminderTitle: "🌼 溫馨提醒",
    reminderText:
      "申請已完成確認，請依申請時段準時接回寶貝。"
  },

  waitlist: {
    label: "候補",
    emoji: "●",
    pillBg: "#FFF0CF",
    pillText: "#8A6A28",
    reminderTitle: "🌼 候補說明",
    reminderText:
      "目前列為候補，本園將依當日實際情形安排；如可提供托育，會再通知家長。"
  },

  rejected: {
    label: "無法安排",
    emoji: "×",
    pillBg: "#F8E6E3",
    pillText: "#A7534E",
    reminderTitle: "🌷 本次申請結果",
    reminderText:
      "本次申請目前無法安排；若有其他需求，歡迎再與本園聯繫。"
  }

};


function jsonResponse(body, status = 200) {

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );

}


function shortTime(value) {

  if (!value) {
    return "";
  }

  return String(value).slice(0, 5);

}


function formatDate(value) {

  if (!value) {
    return "-";
  }

  return String(value).replaceAll("-", " / ");

}


function getTaiwanDateString() {

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:"Asia/Taipei",
        year:"numeric",
        month:"2-digit",
        day:"2-digit"
      }
    )
    .formatToParts(
      new Date()
    );


  const map = {};


  for (const part of parts) {

    if (
      part.type
      !==
      "literal"
    ) {

      map[
        part.type
      ] =
        part.value;

    }

  }


  return (
    map.year
    +
    "-"
    +
    map.month
    +
    "-"
    +
    map.day
  );

}


function requestTypeText(type) {

  const map = {
    leave: "今日請假",
    temporary: "臨時托育",
    extended: "延長托育",
    pickup: "接送通知",
    late: "晚到通報"
  };

  return map[type] || type || "申請";

}


function requestTimeText(row) {

  if (row.request_type === "leave") {
    return "整日";
  }


  const start =
    shortTime(
      row.requested_start_time
    );


  const end =
    shortTime(
      row.requested_end_time
    );


  if (!start && !end) {
    return "-";
  }


  if (start && end) {
    return start + "－" + end;
  }


  return start || end || "-";

}


function infoRow(label, value) {

  return {
    type: "box",
    layout: "horizontal",
    margin: "md",

    contents: [

      {
        type: "text",
        text: label,
        size: "sm",
        color: "#8B9087",
        flex: 3,
        wrap: true
      },

      {
        type: "text",
        text: value || "-",
        size: "sm",
        color: "#4A5047",
        weight: "bold",
        flex: 7,
        wrap: true
      }

    ]
  };

}


function buildFlexMessage(args) {

  const ui =
    STATUS_UI[
      args.status
    ];


  const bodyContents = [

    {
      type: "box",
      layout: "horizontal",
      alignItems: "center",

      contents: [

        {
          type: "image",
          url: LOGO_URL,
          size: "sm",
          aspectMode: "fit",
          flex: 2
        },

        {
          type: "box",
          layout: "vertical",
          flex: 8,
          margin: "md",

          contents: [

            {
              type: "text",
              text: "樂業附幼",
              weight: "bold",
              size: "lg",
              color: "#52644E"
            },

            {
              type: "text",
              text:
                "臺中市東區樂業國民小學附設幼兒園",
              size: "xxs",
              color: "#858A81",
              wrap: true,
              margin: "xs"
            }

          ]

        }

      ]
    },


    {
      type: "separator",
      margin: "lg",
      color: "#E8E3D8"
    },


    {
      type: "text",
      text: "申請結果通知",
      weight: "bold",
      size: "xl",
      color: "#40513D",
      margin: "lg"
    },


    {
      type: "box",
      layout: "horizontal",
      margin: "md",
      backgroundColor:
        ui.pillBg,
      cornerRadius: "xl",
      paddingAll: "8px",

      contents: [

        {
          type: "text",
          text:
            ui.emoji
            +
            " "
            +
            ui.label,
          align: "center",
          weight: "bold",
          size: "sm",
          color:
            ui.pillText
        }

      ]
    },


    infoRow(
      "👶 幼兒",
      args.childName
    ),


    infoRow(
      "🏫 原班級",
      args.morningClassName
    ),


    infoRow(
      "📝 申請類型",
      args.requestType
    ),


    infoRow(
      "📅 日期",
      args.requestDate
    ),


    infoRow(
      "⏰ 時段",
      args.requestTime
    )

  ];


  if (
    args.status === "approved"
    &&
    args.aftercareClassName
  ) {

    bodyContents.push(

      infoRow(
        "🏫 課後班級",
        args.aftercareClassName + (args.aftercareExtension ? "（分機 " + args.aftercareExtension + "）" : "")
      )

    );

  }


  if (args.adminNote) {

    bodyContents.push(

      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        backgroundColor:
          "#FFF5D8",
        cornerRadius: "lg",
        paddingAll: "12px",

        contents: [

          {
            type: "text",
            text: "🏫 本園備註",
            size: "sm",
            weight: "bold",
            color: "#806D3B"
          },

          {
            type: "text",
            text:
              args.adminNote,
            size: "sm",
            color: "#71623E",
            wrap: true,
            margin: "sm"
          }

        ]
      }

    );

  }


  let reminderText =
    ui.reminderText;


  if (
    args.requestType === "今日請假"
    &&
    args.status === "approved"
  ) {

    reminderText =
      "本園已收到並確認本次請假。";

  }


  if (args.status === "approved" && args.aftercareClassName && ["臨時托育","延長托育"].includes(args.requestType)) {
    reminderText += " 如需延後托育時間，請直接撥打課後教室分機" + (args.aftercareExtension ? " " + args.aftercareExtension : "") + "，與老師聯繫。";
  }

  bodyContents.push(

    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      backgroundColor:
        "#EEF4EA",
      cornerRadius: "lg",
      paddingAll: "12px",

      contents: [

        {
          type: "text",
          text:
            ui.reminderTitle,
          size: "sm",
          weight: "bold",
          color: "#52644E"
        },

        {
          type: "text",
          text:
            reminderText,
          size: "sm",
          color: "#5F7259",
          wrap: true,
          margin: "sm"
        }

      ]
    }

  );


  return {

    type: "flex",

    altText:
      "樂業附幼｜"
      +
      ui.label
      +
      "｜"
      +
      args.childName,

    contents: {

      type: "bubble",

      body: {

        type: "box",
        layout: "vertical",
        backgroundColor:
          "#FFFEFA",
        paddingAll: "18px",
        contents:
          bodyContents

      },


      footer: {

        type: "box",
        layout: "vertical",
        backgroundColor:
          "#F4F1E8",
        paddingAll: "12px",

        contents: [

          {
            type: "button",
            style: "primary",
            color: "#819B73",
            height: "sm",

            action: {
              type: "uri",
              label:
                "查看我的申請",
              uri:
                LIFF_REQUESTS_URL
            }
          }

        ]

      }

    }

  };

}


Deno.serve(
  async (req) => {


    if (req.method === "OPTIONS") {

      return new Response(
        "ok",
        {
          headers:
            corsHeaders
        }
      );

    }


    if (req.method !== "POST") {

      return jsonResponse(
        {
          error:
            "Method not allowed"
        },
        405
      );

    }


    try {


      if (
        !SUPABASE_URL
        ||
        !SUPABASE_SERVICE_ROLE_KEY
      ) {

        throw new Error(
          "Supabase server environment variables are missing."
        );

      }


      if (
        !LINE_CHANNEL_ACCESS_TOKEN
      ) {

        throw new Error(
          "LINE_CHANNEL_ACCESS_TOKEN is not configured."
        );

      }


      const authHeader =
        req.headers.get(
          "Authorization"
        )
        || "";


      let jwt = "";


      if (
        authHeader.startsWith(
          "Bearer "
        )
      ) {

        jwt =
          authHeader
            .slice(7)
            .trim();

      }


      if (!jwt) {

        return jsonResponse(
          {
            error:
              "Missing admin authorization token."
          },
          401
        );

      }


      const adminClient =
        createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false
            }
          }
        );


      const {
        data: userData,
        error: userError
      } =
        await adminClient
          .auth
          .getUser(
            jwt
          );


      if (
        userError
        ||
        !userData
        ||
        !userData.user
      ) {

        return jsonResponse(
          {
            error:
              "Invalid or expired admin session."
          },
          401
        );

      }


      const authUser =
        userData.user;


      const {
        data: identity,
        error: identityError
      } =
        await adminClient
          .from(
            "user_identities"
          )
          .select(
            "staff_id"
          )
          .eq(
            "auth_user_id",
            authUser.id
          )
          .maybeSingle();


      if (
        identityError
        ||
        !identity
        ||
        !identity.staff_id
      ) {

        return jsonResponse(
          {
            error:
              "Admin identity not found."
          },
          403
        );

      }


      const {
        data: staff,
        error: staffError
      } =
        await adminClient
          .from(
            "staff"
          )
          .select(
            "id,role,active"
          )
          .eq(
            "id",
            identity.staff_id
          )
          .maybeSingle();


      if (
        staffError
        ||
        !staff
        ||
        staff.role !== "admin"
        ||
        staff.active !== true
      ) {

        return jsonResponse(
          {
            error:
              "Admin permission required."
          },
          403
        );

      }


      let body = {};


      try {

        body =
          await req.json();

      }
      catch (e) {

        body = {};

      }


      const requestId =
        String(
          body.requestId || ""
        ).trim();


      if (!requestId) {

        return jsonResponse(
          {
            error:
              "requestId is required."
          },
          400
        );

      }


      const {
        data: requestRow,
        error: requestError
      } =
        await adminClient
          .from(
            "requests"
          )
          .select(
            `
              id,
              request_date,
              child_id,
              guardian_id,
              request_type,
              status,
              requested_start_time,
              requested_end_time,
              assigned_aftercare_class_code,
              admin_note
            `
          )
          .eq(
            "id",
            requestId
          )
          .maybeSingle();


      if (
        requestError
        ||
        !requestRow
      ) {

        return jsonResponse(
          {
            error:
              "Request not found."
          },
          404
        );

      }


      if (
        String(
          requestRow.request_date
          ||
          ""
        )
        <
        getTaiwanDateString()
      ) {

        return jsonResponse(
          {
            ok:true,
            skipped:true,
            reason:"past_request"
          }
        );

      }


      if (
        ![
          "approved",
          "waitlist",
          "rejected"
        ].includes(
          requestRow.status
        )
      ) {

        return jsonResponse(
          {
            error:
              "Unsupported notification status: "
              +
              requestRow.status
          },
          400
        );

      }


      const {
        data: identityRows,
        error: lineIdentityError
      } =
        await adminClient
          .from(
            "user_identities"
          )
          .select(
            "line_user_id"
          )
          .eq(
            "guardian_id",
            requestRow.guardian_id
          )
          .not(
            "line_user_id",
            "is",
            null
          )
          .limit(1);


      if (lineIdentityError) {
        throw lineIdentityError;
      }


      let lineUserId = "";


      if (
        identityRows
        &&
        identityRows.length
        &&
        identityRows[0]
        &&
        identityRows[0].line_user_id
      ) {

        lineUserId =
          identityRows[0]
            .line_user_id;

      }


      if (!lineUserId) {

        return jsonResponse(
          {
            error:
              "This guardian has no LINE user ID binding."
          },
          400
        );

      }


      const {
        data: child,
        error: childError
      } =
        await adminClient
          .from(
            "children"
          )
          .select(
            "id,name,morning_class_id,school_code"
          )
          .eq(
            "id",
            requestRow.child_id
          )
          .maybeSingle();


      if (
        childError
        ||
        !child
      ) {

        return jsonResponse(
          {
            error:
              "Child data not found."
          },
          404
        );

      }


      const status =
        requestRow.status;


      let aftercareClassName = "";


      if (
        requestRow.assigned_aftercare_class_code
      ) {

        const {
          data:aftercareClass
        } =
          await adminClient
            .from(
              "aftercare_classes"
            )
            .select(
              "name"
            )
            .eq(
              "id",
              requestRow.assigned_aftercare_class_code
            )
            .maybeSingle();


        aftercareClassName =
          aftercareClass?.name
          ||
          AFTERCARE_CLASS_MAP[
            requestRow.assigned_aftercare_class_code
          ]
          ||
          requestRow.assigned_aftercare_class_code;

      }


      const {
        data:morningClass
      } =
        await adminClient
          .from(
            "classes"
          )
          .select(
            "name"
          )
          .eq(
            "id",
            child.morning_class_id
          )
          .maybeSingle();


      const morningClassName =
        morningClass?.name
        ||
        CLASS_MAP[
          child.morning_class_id
        ]
        ||
        child.morning_class_id
        ||
        "未設定班級";


      const message =
        buildFlexMessage(
          {
            status:
              status,

            childName:
              child.name
              ||
              "幼兒",

            morningClassName:
              morningClassName,

            requestType:
              requestTypeText(
                requestRow.request_type
              ),

            requestDate:
              formatDate(
                requestRow.request_date
              ),

            requestTime:
              requestTimeText(
                requestRow
              ),

            aftercareClassName:
              aftercareClassName,

            aftercareExtension:
              AFTERCARE_EXTENSIONS[requestRow.assigned_aftercare_class_code] || "",

            adminNote:
              requestRow.admin_note
              ?
              String(
                requestRow.admin_note
              ).trim()
              :
              ""
          }
        );


      const lineResponse =
        await fetch(
          "https://api.line.me/v2/bot/message/push",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                "Bearer "
                +
                LINE_CHANNEL_ACCESS_TOKEN
            },

            body:
              JSON.stringify(
                {
                  to:
                    lineUserId,

                  messages: [
                    message
                  ]
                }
              )
          }
        );


      const lineText =
        await lineResponse
          .text();


      if (
        !lineResponse.ok
      ) {

        console.error(
          "LINE push failed:",
          lineResponse.status,
          lineText
        );


        return jsonResponse(
          {
            error:
              "LINE push failed.",

            lineStatus:
              lineResponse.status,

            lineBody:
              lineText
          },
          502
        );

      }


      return jsonResponse(
        {
          ok:
            true,

          requestId:
            requestId,

          status:
            status,

          message:
            "LINE Flex Message sent."
        }
      );


    }
    catch (error) {


      console.error(
        error
      );


      let errorMessage =
        "Unknown error";


      if (
        error
        &&
        error.message
      ) {

        errorMessage =
          error.message;

      }
      else {

        errorMessage =
          String(
            error
          );

      }


      return jsonResponse(
        {
          error:
            errorMessage
        },
        500
      );

    }

  }
);