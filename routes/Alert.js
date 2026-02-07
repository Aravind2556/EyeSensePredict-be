const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
require("dotenv").config();

let lastStatus = null; // prevent repeated emails

// ---------------- PARAMETERS + RANGES ----------------
const PARAMS = [
  { name: "Eye Surface Temperature", unit: "°C", min: 33.0, max: 36.0 },
  { name: "Ocular Redness Index", unit: "", min: 0.0, max: 1.5 },
  { name: "Tear Film Stability", unit: "sec", min: 10, max: 30 },
  { name: "Perfusion Index", unit: "%", min: 3, max: 20 },
  { name: "Ocular Oxygenation Level", unit: "%", min: 92, max: 100 },
  { name: "Tissue Health Index", unit: "", min: 70, max: 100 },
  { name: "Ocular Hydration Index", unit: "%", min: 60, max: 100 },
];

// ---------------- MAIL SETUP ----------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_EMAIL_PASS,
  },
});

// ---------------- HELPER ----------------
const isNormal = (value, min, max) =>
  value !== undefined && value >= min && value <= max;

// ---------------- SEND MAIL ----------------
const sendAlertMail = async (prediction, values) => {
  const rows = PARAMS.map((p, i) => {
    const value = values[i];
    const normal = isNormal(value, p.min, p.max);

    return `
      <tr>
        <td>${p.name}</td>
        <td>${value ?? "—"} ${p.unit}</td>
        <td>${p.min} – ${p.max} ${p.unit}</td>
        <td style="color:${normal ? "green" : "red"}; font-weight:600">
          ${normal ? "Normal" : "Abnormal"}
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <h2 style="color:#dc2626">🚨 Eye Health Alert</h2>
    <p><strong>Status:</strong> ${prediction}</p>

    <table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse">
      <thead style="background:#f3f4f6">
        <tr>
          <th align="left">Parameter</th>
          <th align="left">Measured Value</th>
          <th align="left">Normal Range</th>
          <th align="left">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin-top:12px">
      ⚠ Automated eye monitoring system detected abnormal metrics.<br/>
      Please recommend clinical evaluation.
    </p>
  `;

  await transporter.sendMail({
    from: `"Eye Monitor" <${process.env.ALERT_EMAIL}>`,
    to: process.env.DOCTOR_EMAIL,
    subject: "🚨 Eye Health Alert – Abnormal Reading",
    html,
  });
};

// ---------------- MAIN CHECK FUNCTION ----------------
const checkAndSendAlert = async () => {
  try {
    const res = await fetch("http://localhost:8000/predict");
    const data = await res.json();

    const prediction = data?.prediction;
    const values = data?.latest_values;

    if (!prediction || !Array.isArray(values)) return;

    // Send mail only when status changes to Abnormal
    if (prediction === "Abnormal" && lastStatus === "Abnormal") {
      await sendAlertMail(prediction, values);
      console.log("🚨 Alert email sent");
    }

    lastStatus = prediction;
  } catch (err) {
    console.error("Alert service error:", err.message);
  }
};

module.exports = { checkAndSendAlert };
