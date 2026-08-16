const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

admin.initializeApp();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

const db = admin.firestore();

const CODE_TTL_MINUTES = 10;
const VERIFY_COLLECTION = "emailVerifications";

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(email, code) {
  return crypto
    .createHash("sha256")
    .update(`${cleanEmail(email)}:${String(code)}:LTN_FIREBASE_CODE_2026`)
    .digest("hex");
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_EMAIL.value(),
      pass: SMTP_PASSWORD.value(),
    },
  });
}

async function sendCodeEmail({ to, fullName, code }) {
  const transporter = getTransporter();

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:#3d5a80;padding:22px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:#ffffff">LinkTradeNetwork</div>
    </div>

    <div style="padding:26px">
      <p style="font-size:16px;color:#1e293b">Hi ${fullName || "there"},</p>

      <p style="font-size:15px;color:#334155">
        Your LinkTradeNetwork verification code is:
      </p>

      <div style="font-size:38px;font-weight:800;letter-spacing:8px;color:#ea6a00;text-align:center;padding:18px;background:#fff7ed;border-radius:10px;margin:18px 0">
        ${code}
      </div>

      <p style="font-size:14px;color:#64748b">
        This code expires in ${CODE_TTL_MINUTES} minutes.
      </p>

      <p style="font-size:14px;color:#64748b">
        After you verify, you can create your 6-digit password/code.
      </p>

      <p style="font-size:14px;color:#1e293b">
        - LinkTradeNetwork Team
      </p>
    </div>
  </div>
  `;

  await transporter.sendMail({
    from: `"LinkTradeNetwork" <${SMTP_EMAIL.value()}>`,
    to,
    subject: "Your LinkTradeNetwork Verification Code",
    text: `Your LinkTradeNetwork verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    html,
  });
}

async function sendWelcomeEmail({ to, fullName }) {
  const transporter = getTransporter();

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">

    <div style="background:#ffffff;padding:14px 18px;border-bottom:1px solid #e2e8f0">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="background:#ea6a00;color:white;font-weight:800;font-size:18px;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center">
          LTN
        </div>

        <div style="font-size:22px;font-weight:800;color:#1e293b">
          LinkTradeNetwork
        </div>
      </div>
    </div>

    <div style="background:#3d5a80;padding:24px;text-align:center">
      <h1 style="color:white;margin:0;font-size:26px">
        Welcome to LinkTradeNetwork!
      </h1>
    </div>

    <div style="padding:26px;color:#1e293b">

      <p style="font-size:16px;margin-top:0">
        Hi ${fullName || "there"},
      </p>

      <p style="font-size:17px;font-weight:700;margin-bottom:20px">
        Your account is verified! Here is what you can do on LTN:
      </p>

      <div style="background:#f8fafc;border-radius:10px;padding:20px">

        <h3 style="color:#ea6a00;margin:0 0 8px">
          Find Skilled Trade Jobs
        </h3>

        <p style="color:#64748b;margin:0 0 18px;line-height:1.5">
          Browse trade opportunities by location, trade, job type, and company.
        </p>


        <h3 style="color:#ea6a00;margin:0 0 8px">
          Use the Apprenticeship Dashboard
        </h3>

        <p style="color:#64748b;margin:0 0 18px;line-height:1.5">
          Track your hours, completed skills, certifications, and progress as you build your trade career.
        </p>


        <h3 style="color:#ea6a00;margin:0 0 8px">
          Connect with Members
        </h3>

        <p style="color:#64748b;margin:0 0 18px;line-height:1.5">
          Build your professional trade network, send connection requests, and message other members.
        </p>


        <h3 style="color:#ea6a00;margin:0 0 8px">
          Post and Share Updates
        </h3>

        <p style="color:#64748b;margin:0 0 18px;line-height:1.5">
          Share your work, ask questions, post trade updates, and stay active in the community feed.
        </p>


        <h3 style="color:#ea6a00;margin:0 0 8px">
          Upload Your 10-Second Trade Video
        </h3>

        <p style="color:#64748b;margin:0 0 18px;line-height:1.5">
          Upload short videos of projects, progress, tools, job sites, trade tips, and real trade accomplishments.
        </p>


        <h3 style="color:#ea6a00;margin:0 0 8px">
          Take the Skill Challenge &amp; Win
        </h3>

        <p style="color:#64748b;margin:0 0 18px;line-height:1.5">
          Test your trade knowledge, compete with other members, advance through the challenge, and compete for cash prizes.
        </p>


        <h3 style="color:#ea6a00;margin:0 0 8px">
          Join Interactive Training
        </h3>

        <p style="color:#64748b;margin:0;line-height:1.5">
          Join live skilled-trades training directly inside LinkTradeNetwork.
          No separate Zoom or Teams login is required.
        </p>

      </div>


      <div style="text-align:center;margin:28px 0">

        <a
          href="https://linktradenetwork.com/dashboard/"
          style="
            background:#ea6a00;
            color:white;
            padding:14px 24px;
            text-decoration:none;
            border-radius:8px;
            font-weight:700;
            display:inline-block;
            margin-bottom:12px;
          "
        >
          Go to Dashboard
        </a>

        <br>

        <a
          href="https://linktradenetwork.com/SkillChallenge/"
          style="
            background:#172033;
            color:white;
            padding:12px 20px;
            text-decoration:none;
            border-radius:8px;
            font-weight:700;
            display:inline-block;
            margin:6px;
          "
        >
          Take the Skill Challenge
        </a>

        <a
          href="https://linktradenetwork.com/interactive-training/"
          style="
            background:#3d5a80;
            color:white;
            padding:12px 20px;
            text-decoration:none;
            border-radius:8px;
            font-weight:700;
            display:inline-block;
            margin:6px;
          "
        >
          Interactive Training
        </a>

      </div>


      <p style="margin-bottom:0">
        Welcome aboard,<br>
        <b>LinkTradeNetwork Team</b>
      </p>

    </div>

    <div style="background:#f1f5f9;padding:14px;text-align:center;font-size:12px;color:#64748b">
      © LinkTradeNetwork • Built for the skilled trades
    </div>

  </div>
  `;

  const text = `
Hi ${fullName || "there"},

Welcome to LinkTradeNetwork. Your account has been created successfully.

Here is what you can do on LTN:

- Find skilled trade jobs.
- Use the Apprenticeship Dashboard to track hours, skills, certifications, and progress.
- Connect with members and build your professional trade network.
- Post and share updates.
- Upload your 10-second trade video.
- Take the LinkTradeNetwork Skill Challenge and compete to win cash prizes.
- Join Interactive Training directly inside LinkTradeNetwork with no separate Zoom or Teams login required.

Dashboard:
https://linktradenetwork.com/dashboard/

Skill Challenge:
https://linktradenetwork.com/SkillChallenge/

Interactive Training:
https://linktradenetwork.com/interactive-training/

Welcome aboard,
LinkTradeNetwork Team
  `;

  await transporter.sendMail({
    from: `"LinkTradeNetwork" <${SMTP_EMAIL.value()}>`,
    to,
    subject: "Welcome to LinkTradeNetwork",
    text,
    html,
  });
}


exports.requestVerificationCode = onCall(
  { secrets: [SMTP_EMAIL, SMTP_PASSWORD] },
  async (request) => {
    const data = request.data || {};

    const email = cleanEmail(data.email);
    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();
    const fullName = String(
      data.fullName || `${firstName} ${lastName}`
    ).trim();

    const consent = data.consent === true;

    if (!firstName || !lastName) {
      throw new HttpsError(
        "invalid-argument",
        "First and last name are required."
      );
    }

    if (!email || !email.includes("@")) {
      throw new HttpsError(
        "invalid-argument",
        "Valid email is required."
      );
    }

    if (!consent) {
      throw new HttpsError(
        "invalid-argument",
        "Terms acceptance is required."
      );
    }

    const existing =
      await admin
        .auth()
        .getUserByEmail(email)
        .catch(() => null);

    if (existing) {
      throw new HttpsError(
        "already-exists",
        "That email is already registered. Please sign in."
      );
    }

    const code = makeCode();

    const now =
      admin.firestore.Timestamp.now();

    const expiresAt =
      admin.firestore.Timestamp.fromMillis(
        Date.now() +
        CODE_TTL_MINUTES * 60 * 1000
      );

    await db
      .collection(VERIFY_COLLECTION)
      .doc(email)
      .set(
        {
          email,
          firstName,
          lastName,
          fullName,
          consent: true,
          codeHash: hashCode(email, code),
          attempts: 0,
          verified: false,
          createdAt: now,
          updatedAt: now,
          expiresAt,
          userAgent:
            String(data.userAgent || "").slice(0, 500),
        },
        {
          merge: true
        }
      );

    await sendCodeEmail({
      to: email,
      fullName,
      code,
    });

    return {
      success: true,
      message: "Verification code sent.",
    };
  }
);


exports.verifySignupCode = onCall(
  async (request) => {
    const data = request.data || {};

    const email =
      cleanEmail(data.email);

    const code =
      String(data.code || "").trim();

    if (!email || !code) {
      throw new HttpsError(
        "invalid-argument",
        "Email and code are required."
      );
    }

    const ref =
      db
        .collection(VERIFY_COLLECTION)
        .doc(email);

    const snap =
      await ref.get();

    if (!snap.exists) {
      throw new HttpsError(
        "not-found",
        "No verification code found. Please request a new code."
      );
    }

    const saved =
      snap.data();

    const attempts =
      Number(saved.attempts || 0);

    if (attempts >= 5) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many attempts. Please request a new code."
      );
    }

    if (
      !saved.expiresAt ||
      saved.expiresAt.toMillis() < Date.now()
    ) {
      throw new HttpsError(
        "deadline-exceeded",
        "Code expired. Please request a new code."
      );
    }

    const valid =
      saved.codeHash ===
      hashCode(email, code);

    if (!valid) {
      await ref.update({
        attempts:
          admin.firestore.FieldValue.increment(1),

        updatedAt:
          admin.firestore.Timestamp.now(),
      });

      throw new HttpsError(
        "permission-denied",
        "Invalid code."
      );
    }

    await ref.update({
      verified: true,

      verifiedAt:
        admin.firestore.Timestamp.now(),

      updatedAt:
        admin.firestore.Timestamp.now(),
    });

    return {
      success: true,
      message: "Email verified.",
    };
  }
);


exports.createVerifiedUser = onCall(
  {
    secrets: [
      SMTP_EMAIL,
      SMTP_PASSWORD
    ]
  },

  async (request) => {
    const data =
      request.data || {};

    const email =
      cleanEmail(data.email);

    const password =
      String(data.password || "").trim();

    const firstName =
      String(data.firstName || "").trim();

    const lastName =
      String(data.lastName || "").trim();

    const fullName =
      String(
        data.fullName ||
        `${firstName} ${lastName}`
      ).trim();

    if (
      !email ||
      !password ||
      !firstName ||
      !lastName
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Email, password, first name, and last name are required."
      );
    }

    if (password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be 6 digits."
      );
    }

    const verifyRef =
      db
        .collection(VERIFY_COLLECTION)
        .doc(email);

    const verifySnap =
      await verifyRef.get();

    if (!verifySnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Please verify your email first."
      );
    }

    const verifyData =
      verifySnap.data();

    if (!verifyData.verified) {
      throw new HttpsError(
        "failed-precondition",
        "Please verify your email first."
      );
    }

    if (
      !verifyData.expiresAt ||
      verifyData.expiresAt.toMillis() <
      Date.now()
    ) {
      throw new HttpsError(
        "deadline-exceeded",
        "Verification expired. Please request a new code."
      );
    }

    let userRecord;

    try {
      userRecord =
        await admin
          .auth()
          .createUser({
            email,
            password,
            displayName: fullName,
            emailVerified: true,
            disabled: false,
          });

    } catch (err) {

      if (
        err.code ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "That email is already registered. Please sign in."
        );
      }

      console.error(
        "createUser error:",
        err
      );

      throw new HttpsError(
        "internal",
        "Could not create account."
      );
    }

    const uid =
      userRecord.uid;

    const now =
      admin.firestore.Timestamp.now();

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          uid,
          email,
          firstName,
          lastName,
          fullName,
          name: fullName,
          displayName: fullName,
          createdAt: now,
          updatedAt: now,
          emailVerified: true,
          source:
            "firebase-auth-code-signup",
          termsAccepted: true,
          role: "member",
        },
        {
          merge: true
        }
      );

    await db
      .collection("profiles")
      .doc(uid)
      .set(
        {
          uid,
          email,
          firstName,
          lastName,
          fullName,
          name: fullName,
          createdAt: now,
          updatedAt: now,
        },
        {
          merge: true
        }
      );

    await verifyRef.delete();


    /* =====================================================
       SEND WELCOME EMAIL
       ===================================================== */

    try {

      await sendWelcomeEmail({
        to: email,
        fullName,
      });

    } catch (emailErr) {

      console.error(
        "Welcome email failed, but user was created:",
        emailErr
      );

    }


    return {
      success: true,
      uid,
      email,
      fullName,
    };
  }
);


exports.getMemberCount = onCall(
  async () => {

    try {

      const snap =
        await db
          .collection("users")
          .count()
          .get();

      return {
        success: true,
        count:
          snap.data().count || 0,
      };

    } catch (err) {

      console.error(
        "getMemberCount error:",
        err
      );

      return {
        success: true,
        count: 0,
      };
    }

  }
);
