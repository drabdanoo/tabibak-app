/**
 * PrescriptionScreen — Phase 5: PDF Generation & Sharing
 *
 * Generates a professional Arabic-RTL medical prescription PDF from encounter
 * data and exposes two CTA actions: Share (native share sheet) and Print
 * (OS print panel). The native UI itself is a clean FlatList of medications
 * with a patient/diagnosis summary header — it never attempts to render HTML.
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * ┌─ EXPO PRINT INTEGRATION ───────────────────────────────────────────────────
 * │
 * │  Two Expo APIs, zero third-party PDF libraries:
 * │
 * │  expo-print v15
 * │  ───────────────
 * │  • Print.printToFileAsync({ html }) → Promise<{ uri, numberOfPages }>
 * │      Feeds the HTML string to the system's embedded WebView renderer
 * │      (WKWebView on iOS, Android WebView on Android) and writes a PDF to
 * │      the app's document directory. Returns a local file:// URI.
 * │
 * │  • Print.printAsync({ html }) → Promise<void>
 * │      Sends the HTML directly to the OS print panel (AirPrint on iOS,
 * │      Android Print Service on Android). No file is written to disk.
 * │      If the user cancels the dialog, the Promise resolves silently.
 * │
 * │  expo-sharing v14
 * │  ──────────────────
 * │  • Sharing.isAvailableAsync() → Promise<boolean>
 * │      Guards against calling shareAsync in environments that do not
 * │      support sharing (e.g., iOS Simulator, web builds).
 * │
 * │  • Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle })
 * │      Opens the native share sheet (UIActivityViewController on iOS,
 * │      Android Intent.ACTION_SEND). The PDF file URI produced by
 * │      printToFileAsync is passed directly.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ SHARE PDF FLOW ───────────────────────────────────────────────────────────
 * │
 * │   buildPrescriptionHTML(encounter, doctorInfo)
 * │        ↓ pure function → html string
 * │   Print.printToFileAsync({ html })
 * │        ↓ WebView renders → writes PDF → returns { uri }
 * │   Sharing.isAvailableAsync()
 * │        ↓ true
 * │   Sharing.shareAsync(uri, { mimeType:'application/pdf', ... })
 * │        ↓ native share sheet opens
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ PRINT PDF FLOW ───────────────────────────────────────────────────────────
 * │
 * │   buildPrescriptionHTML(encounter, doctorInfo)
 * │        ↓ pure function → html string
 * │   Print.printAsync({ html })
 * │        ↓ OS print panel opens (AirPrint / Android Print Service)
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ HTML TEMPLATE — RTL ARABIC ───────────────────────────────────────────────
 * │
 * │  buildPrescriptionHTML(encounter, doctorInfo) is a PURE function — no
 * │  hooks, no side effects, fully testable in isolation.
 * │
 * │  The document declares:  <html dir="rtl" lang="ar">
 * │  All inline CSS uses RTL-aware properties where needed:
 * │    border-inline-start  (= border-right in dir="rtl")
 * │    text-align: right
 * │    direction: rtl
 * │
 * │  All user-supplied strings pass through escapeHtml() before being
 * │  interpolated into the template. This prevents injection via
 * │  medication drug names, patient names, diagnosis strings, etc.
 * │
 * │  Prescription structure (top → bottom):
 * │
 * │  ┌─ Header ──────────────────────────────────────────────────────────┐
 * │  │  Clinic name (green)  ·  Doctor name  ·  Contact  │  ℞ symbol     │
 * │  └────────────────────────────────────────────────────────────────────┘
 * │  ┌─ Meta strip ──────────────────────────────────────────────────────┐
 * │  │  Date                             │  Prescription number           │
 * │  └────────────────────────────────────────────────────────────────────┘
 * │  ┌─ Patient box (green border) ──────────────────────────────────────┐
 * │  │  اسم المريض   │  العمر   │  تاريخ الزيارة   │  الوقت             │
 * │  └────────────────────────────────────────────────────────────────────┘
 * │  ┌─ Diagnosis (green inline-start stripe) ───────────────────────────┐
 * │  │  التشخيص: {diagnosis}                                              │
 * │  └────────────────────────────────────────────────────────────────────┘
 * │  Medications table: # | الدواء | الجرعة | التكرار | المدة | تعليمات
 * │  ┌─ Footer ───────────────────────────────────────────────────────────┐
 * │  │  Clinic stamp (dashed circle)  │  Validity  │  Doctor signature    │
 * │  └────────────────────────────────────────────────────────────────────┘
 * │  Rx note line: "وصفة طبية إلكترونية | {rxNumber} | طبيبك"
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ DATA CONTRACT (route.params) ─────────────────────────────────────────────
 * │
 * │  route.params.encounter = {
 * │    appointmentId?,      // used to derive deterministic Rx number
 * │    appointmentDate,     // 'YYYY-MM-DD'
 * │    appointmentTime,     // 'HH:mm'
 * │    patientName,
 * │    patientAge?,         // number or string (if pre-computed)
 * │    patientDOB?,         // 'YYYY-MM-DD' (used to compute age if patientAge absent)
 * │    diagnosis,
 * │    clinicalNotes?,
 * │    medications: [{
 * │      drug,              // required
 * │      dosage,            // required
 * │      frequency,         // required
 * │      duration?,         // optional  e.g. '30 days'
 * │      instructions?,     // optional  e.g. 'Take with food'
 * │    }],
 * │    // Optional clinic overrides (fall back to app defaults):
 * │    clinicName?,
 * │    clinicPhone?,
 * │    clinicAddress?,
 * │  }
 * │
 * │  Doctor name + specialty are read from useAuth().userProfile at runtime
 * │  so they are always up-to-date without needing to thread them through
 * │  every navigation call.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ RTL NATIVE UI RULE ───────────────────────────────────────────────────────
 * │
 * │  ⚠️  Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
 * │  or positional left/right in the StyleSheet. Logical properties only:
 * │    marginStart / marginEnd / paddingStart / paddingEnd /
 * │    borderStartWidth / borderEndWidth / start / end
 * │
 * └────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// App-level defaults (override via encounter.clinicXxx params)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CLINIC_NAME = 'طبيبك — Tabibak';
const DEFAULT_CLINIC_PHONE = '+966 11 000 0000';
const DEFAULT_CLINIC_ADDRESS = 'الرياض، المملكة العربية السعودية';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper functions (no hooks — safe to call in render or async handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitise a string for safe interpolation into an HTML template.
 * Replaces the five XML/HTML special characters with their entity references.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 'YYYY-MM-DD' → '07 March 2026' (Gregorian, English long-form).
 * Medical documents in Arab countries use Gregorian dates for
 * international legibility.
 */
function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** 'YYYY-MM-DD' → 'Mar 7, 2026' (compact, for native UI chips). */
function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** 'HH:mm' → '9:00 AM' / '2:30 PM'. */
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Compute age in completed years from a 'YYYY-MM-DD' date of birth.
 * Returns null if dob is absent or malformed.
 */
function calcAge(dob) {
  if (!dob) return null;
  try {
    const [y, mo, d] = dob.split('-').map(Number);
    const birth = new Date(y, mo - 1, d);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) age--;
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

/**
 * Derive a short, deterministic prescription number from an appointmentId.
 * The same appointmentId always produces the same Rx number so regenerating
 * the PDF gives a consistent number. Falls back to a timestamp-based code
 * when no appointmentId is available.
 */
function deriveRxNumber(appointmentId) {
  if (!appointmentId) {
    return `RX-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
  // Strip non-alphanumeric, take last 8 chars, prefix with RX-
  const slug = appointmentId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  return `RX-${slug || Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template Builder
//
// Pure function — receives all data, returns a self-contained HTML string.
// Rendered by the system WebView inside expo-print (not shown in the app UI).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} encounter  - Full encounter object from route.params
 * @param {object} doctorInfo - { doctorName, specialty } from userProfile
 * @param {string} rxNumber   - Pre-computed prescription number
 * @returns {string}          - Complete HTML document string
 */
function buildPrescriptionHTML(encounter, doctorInfo, rxNumber) {
  const {
    appointmentDate = '',
    appointmentTime = '',
    patientName = '—',
    patientAge = null,
    patientDOB = null,
    diagnosis = '—',
    medications = [],
    clinicName = DEFAULT_CLINIC_NAME,
    clinicPhone = DEFAULT_CLINIC_PHONE,
    clinicAddress = DEFAULT_CLINIC_ADDRESS,
  } = encounter;

  const { doctorName = '—', specialty = '—' } = doctorInfo;

  // Resolve patient age: prefer explicit value, compute from DOB as fallback
  const resolvedAge = patientAge ?? calcAge(patientDOB);
  const ageStr = resolvedAge != null ? `${resolvedAge} سنة` : '—';

  // Build medication table rows — each drug becomes a <tr>
  const medicationRows = medications.length > 0
    ? medications.map((med, idx) => `
        <tr>
          <td style="text-align:center;font-weight:700;color:#6b7280;">${idx + 1}</td>
          <td>
            <div class="drug-name">${escapeHtml(med.drug) || '—'}</div>
          </td>
          <td>${escapeHtml(med.dosage) || '—'}</td>
          <td>${escapeHtml(med.frequency) || '—'}</td>
          <td>${escapeHtml(med.duration) || '—'}</td>
          <td>${escapeHtml(med.instructions) || '—'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:20px;">
        لا توجد أدوية في هذه الوصفة
       </td></tr>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>وصفة طبية — ${escapeHtml(rxNumber)}</title>
  <style>
    /* ── Reset ─────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Base ──────────────────────────────────────────────────────── */
    body {
      font-family: 'Segoe UI', Tahoma, 'Geeza Pro', 'Arabic Typesetting',
                   'Simplified Arabic', 'Helvetica Neue', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      color: #1f2937;
      background: #ffffff;
      padding: 36px 44px;
      font-size: 13px;
      line-height: 1.65;
    }

    /* ── Header ─────────────────────────────────────────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #10b981;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .clinic-name {
      font-size: 22px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 6px;
    }
    .clinic-meta {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.8;
    }
    /* ℞ glyph — decorative, placed at the logical-end side of the header.
       In dir="rtl" the flex end is the physical left. */
    .rx-glyph {
      font-size: 56px;
      font-weight: 900;
      color: #10b981;
      line-height: 0.85;
      opacity: 0.80;
      flex-shrink: 0;
    }

    /* ── Meta strip (date + Rx number) ──────────────────────────────── */
    .meta-strip {
      display: flex;
      justify-content: space-between;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 9px 14px;
      margin-bottom: 18px;
      font-size: 12px;
    }
    .meta-item { display: flex; gap: 6px; align-items: center; }
    .meta-label { color: #6b7280; font-weight: 600; }
    .meta-value { color: #1f2937; font-weight: 700; }

    /* ── Patient info box ────────────────────────────────────────────── */
    .patient-box {
      background: #f0fdf4;
      border: 1.5px solid #10b981;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .pi-row    { display: flex; gap: 8px; align-items: baseline; }
    .pi-label  { font-size: 11px; color: #059669; font-weight: 700; white-space: nowrap; }
    .pi-value  { font-size: 13px; color: #1f2937; font-weight: 600; }

    /* ── Diagnosis block ─────────────────────────────────────────────── */
    /* border-inline-start is the CSS logical property for the reading-start
       border. With dir="rtl" this maps to physical border-right, placing the
       green accent stripe on the Arabic reading-start (right) side. */
    .diagnosis-box {
      background: #ecfdf5;
      border-inline-start: 4px solid #10b981;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 22px;
    }
    .diag-label { font-size: 11px; color: #059669; font-weight: 700; margin-bottom: 4px; }
    .diag-value { font-size: 14px; color: #1f2937; font-weight: 600; line-height: 1.5; }

    /* ── Section heading ─────────────────────────────────────────────── */
    /* ::before creates a green bar at the flex-start.
       In dir="rtl", flex-start is on the right — the reading-start side. */
    .section-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 10px;
    }
    .section-heading::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: #10b981;
      border-radius: 2px;
      flex-shrink: 0;
    }

    /* ── Medications table ───────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      font-size: 12px;
    }
    thead tr { background: #10b981; }
    th {
      color: #ffffff;
      padding: 10px 12px;
      text-align: right;
      font-weight: 700;
      font-size: 12px;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
      color: #374151;
    }
    tbody tr:nth-child(even) td { background: #f9fafb; }
    .drug-name { font-weight: 700; color: #1f2937; font-size: 13px; }

    /* ── Footer ──────────────────────────────────────────────────────── */
    .footer {
      margin-top: 44px;
      border-top: 1px solid #e5e7eb;
      padding-top: 22px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }
    /* Clinic stamp — circular dashed placeholder */
    .stamp-circle {
      width: 96px;
      height: 96px;
      border: 1.5px dashed #d1d5db;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #d1d5db;
      font-size: 10px;
      margin: 0 auto 6px;
    }
    .sig-line {
      border-top: 1.5px solid #374151;
      width: 160px;
      margin: 0 auto 6px;
    }
    .footer-label { font-size: 11px; color: #6b7280; font-weight: 600; text-align: center; }
    .footer-name  { font-size: 12px; color: #374151; font-weight: 700; text-align: center; margin-top: 4px; }
    .validity-note { font-size: 11px; color: #6b7280; text-align: center; line-height: 1.6; }

    /* ── Rx reference line ───────────────────────────────────────────── */
    .rx-note {
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
      margin-top: 22px;
      border-top: 1px dashed #e5e7eb;
      padding-top: 12px;
    }
  </style>
</head>
<body>

  <!-- ── HEADER ──────────────────────────────────────────────────────── -->
  <div class="header">
    <div>
      <div class="clinic-name">${escapeHtml(clinicName)}</div>
      <div class="clinic-meta">
        د. ${escapeHtml(doctorName)} &nbsp;|&nbsp; ${escapeHtml(specialty)}<br/>
        ${escapeHtml(clinicAddress)}<br/>
        ${escapeHtml(clinicPhone)}
      </div>
    </div>
    <div class="rx-glyph">℞</div>
  </div>

  <!-- ── META STRIP ──────────────────────────────────────────────────── -->
  <div class="meta-strip">
    <div class="meta-item">
      <span class="meta-label">التاريخ:</span>
      <span class="meta-value">${escapeHtml(formatDateLong(appointmentDate))}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">رقم الوصفة:</span>
      <span class="meta-value">${escapeHtml(rxNumber)}</span>
    </div>
  </div>

  <!-- ── PATIENT INFO ─────────────────────────────────────────────────── -->
  <div class="patient-box">
    <div class="pi-row">
      <span class="pi-label">اسم المريض:</span>
      <span class="pi-value">${escapeHtml(patientName)}</span>
    </div>
    <div class="pi-row">
      <span class="pi-label">العمر:</span>
      <span class="pi-value">${escapeHtml(ageStr)}</span>
    </div>
    <div class="pi-row">
      <span class="pi-label">تاريخ الزيارة:</span>
      <span class="pi-value">${escapeHtml(formatDateLong(appointmentDate))}</span>
    </div>
    <div class="pi-row">
      <span class="pi-label">وقت الزيارة:</span>
      <span class="pi-value">${escapeHtml(formatTime12(appointmentTime))}</span>
    </div>
  </div>

  <!-- ── DIAGNOSIS ────────────────────────────────────────────────────── -->
  <div class="diagnosis-box">
    <div class="diag-label">التشخيص</div>
    <div class="diag-value">${escapeHtml(diagnosis)}</div>
  </div>

  <!-- ── MEDICATIONS TABLE ────────────────────────────────────────────── -->
  <div class="section-heading">الأدوية الموصوفة</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px;">#</th>
        <th>الدواء</th>
        <th style="width:88px;">الجرعة</th>
        <th style="width:104px;">التكرار</th>
        <th style="width:76px;">المدة</th>
        <th>تعليمات</th>
      </tr>
    </thead>
    <tbody>
      ${medicationRows}
    </tbody>
  </table>

  <!-- ── FOOTER ───────────────────────────────────────────────────────── -->
  <div class="footer">

    <!-- Clinic stamp (logical-start / physical-right in RTL) -->
    <div style="text-align:center;">
      <div class="stamp-circle">ختم العيادة</div>
      <div class="footer-label">الختم الرسمي</div>
    </div>

    <!-- Validity note (centre) -->
    <div class="validity-note">
      صالحة لمدة <strong>30 يوماً</strong> من تاريخ الإصدار<br/>
      ${escapeHtml(clinicName)}<br/>
      ${escapeHtml(clinicPhone)}
    </div>

    <!-- Doctor signature (logical-end / physical-left in RTL) -->
    <div>
      <div style="height:48px;"></div>
      <div class="sig-line"></div>
      <div class="footer-label">توقيع الطبيب</div>
      <div class="footer-name">د. ${escapeHtml(doctorName)}</div>
    </div>
  </div>

  <!-- ── RX REFERENCE LINE ─────────────────────────────────────────────── -->
  <div class="rx-note">
    وصفة طبية إلكترونية &nbsp;·&nbsp; ${escapeHtml(rxNumber)}
    &nbsp;·&nbsp; طبيبك — Tabibak
  </div>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (module-level React.memo — never re-created on parent render)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single medication card in the native FlatList.
 * Displays drug name, dosage chip, frequency chip, optional duration chip,
 * and an optional instructions line below.
 *
 * Layout (LTR):  [Index badge] [Body: drug name, chips row, instructions]
 * Layout (RTL):  flex-row reversal puts the badge on the right (start) side.
 */
const MedicationCard = React.memo(function MedicationCard({ item, index }) {
  return (
    <View style={S.medCard}>
      {/* Numbered index badge at the logical start */}
      <View style={S.medIndex}>
        <Text style={S.medIndexText}>{index + 1}</Text>
      </View>

      {/* Card body */}
      <View style={S.medBody}>
        <Text style={S.medDrug} numberOfLines={2}>
          {item.drug || '—'}
        </Text>

        {/* Chips row: Dosage + Frequency + Duration (if present) */}
        <View style={S.medChips}>
          {item.dosage ? (
            <View style={S.chip}>
              <Ionicons name="fitness-outline" size={11} color={Colors.primary} />
              <Text style={S.chipText}>{item.dosage}</Text>
            </View>
          ) : null}

          {item.frequency ? (
            <View style={S.chip}>
              <Ionicons name="time-outline" size={11} color={Colors.primary} />
              <Text style={S.chipText}>{item.frequency}</Text>
            </View>
          ) : null}

          {item.duration ? (
            <View style={S.chip}>
              <Ionicons name="calendar-outline" size={11} color={Colors.primary} />
              <Text style={S.chipText}>{item.duration}</Text>
            </View>
          ) : null}
        </View>

        {/* Optional instructions line */}
        {item.instructions ? (
          <View style={S.medInstructionsRow}>
            <Ionicons
              name="information-circle-outline"
              size={13}
              color={Colors.textSecondary}
            />
            <Text style={S.medInstructions}>{item.instructions}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

/**
 * FlatList ListHeaderComponent.
 * Shows the patient summary card, Rx meta row, and the "Medications" heading.
 * Extracted as a plain function (not memo) because it's created once and the
 * props are stable primitives derived from route.params.
 */
function ListHeader({ encounter, rxNumber }) {
  const { patientName, patientAge, patientDOB, diagnosis, medications = [] } = encounter;
  const resolvedAge = patientAge ?? calcAge(patientDOB);

  return (
    <View style={S.listHeader}>

      {/* ── Patient summary card ──────────────────────────────────────── */}
      <View style={S.patientCard}>
        {/* Patient name row */}
        <View style={S.patientRow}>
          <View style={S.patientRowIcon}>
            <Ionicons name="person-outline" size={14} color={Colors.primary} />
          </View>
          <Text style={S.patientLabel}>المريض</Text>
          <Text style={S.patientValue} numberOfLines={1}>
            {patientName || '—'}
          </Text>
        </View>

        {/* Age row */}
        {resolvedAge != null ? (
          <View style={[S.patientRow, S.patientRowBorder]}>
            <View style={S.patientRowIcon}>
              <Ionicons name="person-circle-outline" size={14} color={Colors.primary} />
            </View>
            <Text style={S.patientLabel}>العمر</Text>
            <Text style={S.patientValue}>{resolvedAge} سنة</Text>
          </View>
        ) : null}

        {/* Diagnosis row */}
        <View style={[S.patientRow, S.patientRowBorder]}>
          <View style={S.patientRowIcon}>
            <Ionicons name="medkit-outline" size={14} color={Colors.primary} />
          </View>
          <Text style={S.patientLabel}>التشخيص</Text>
          <Text style={[S.patientValue, S.patientValueDiag]} numberOfLines={3}>
            {diagnosis || '—'}
          </Text>
        </View>
      </View>

      {/* ── Rx meta row: prescription number + date ───────────────────── */}
      <View style={S.rxMeta}>
        <View style={S.rxMetaItem}>
          <Ionicons name="document-text-outline" size={13} color={Colors.textSecondary} />
          <Text style={S.rxMetaText}>{rxNumber}</Text>
        </View>
        <View style={S.rxMetaItem}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
          <Text style={S.rxMetaText}>{formatDateShort(encounter.appointmentDate)}</Text>
        </View>
      </View>

      {/* ── Section heading ───────────────────────────────────────────── */}
      <View style={S.medsHeading}>
        {/* Green accent bar — borderStartWidth = logical left in LTR, right in RTL */}
        <View style={S.medsHeadingBar} />
        <Text style={S.medsHeadingText}>الأدوية الموصوفة</Text>
        <View style={S.medsCountBadge}>
          <Text style={S.medsCountText}>{medications.length}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Empty state shown when the medications array is empty.
 * Renders as FlatList ListEmptyComponent.
 */
const EmptyMedications = React.memo(function EmptyMedications() {
  return (
    <View style={S.emptyWrap}>
      <Ionicons name="alert-circle-outline" size={44} color={Colors.warning} />
      <Text style={S.emptyTitle}>لا توجد أدوية</Text>
      <Text style={S.emptyHint}>
        لم يتم إدراج أي دواء في هذه الوصفة.{'\n'}
        The prescription has no medications.
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PrescriptionScreen({ route }) {
  const { encounter = {} } = route.params ?? {};
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // ── Derived stable values (never change after mount) ──────────────────────
  const rxNumber = useMemo(() => deriveRxNumber(encounter.appointmentId), [encounter.appointmentId]);
  const doctorInfo = useMemo(() => ({
    doctorName: userProfile?.fullName ?? user?.displayName ?? '—',
    specialty: userProfile?.specialty ?? '—',
  }), [userProfile, user]);

  const medications = useMemo(
    () => encounter.medications ?? [],
    [encounter.medications],
  );

  // ── Loading states (separate so only the pressed button shows spinner) ─────
  const [generating, setGenerating] = useState(false); // Share PDF
  const [printing, setPrinting] = useState(false); // Print PDF
  const busy = generating || printing;

  // ── Build the HTML string (pure — called inside async handlers, not render) ─
  const getHTML = useCallback(
    () => buildPrescriptionHTML(encounter, doctorInfo, rxNumber),
    [encounter, doctorInfo, rxNumber],
  );

  // ── Handler: Share PDF ────────────────────────────────────────────────────
  // Flow: buildHTML → printToFileAsync (PDF to disk) → shareAsync (share sheet)
  const handleSharePDF = useCallback(async () => {
    setGenerating(true);
    try {
      const html = getHTML();

      // 1. Render HTML → PDF file
      const { uri } = await Print.printToFileAsync({ html });

      // 2. Guard: sharing may not be available (simulators, web)
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Sharing Unavailable',
          'Sharing is not supported on this device or environment.',
        );
        return;
      }

      // 3. Open native share sheet
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'مشاركة الوصفة الطبية',
        UTI: 'com.adobe.pdf', // iOS
      });

    } catch (err) {
      console.error('[Prescription] shareAsync:', err);
      Alert.alert(
        'خطأ في المشاركة',
        'تعذّر إنشاء ملف PDF أو مشاركته. يرجى المحاولة مجدداً.\n' +
        'Failed to generate or share the PDF. Please try again.',
      );
    } finally {
      setGenerating(false);
    }
  }, [getHTML]);

  // ── Handler: Print PDF ────────────────────────────────────────────────────
  // Flow: buildHTML → printAsync (OS print panel opens directly)
  // If the user cancels the print dialog the Promise resolves — no error needed.
  const handlePrintPDF = useCallback(async () => {
    setPrinting(true);
    try {
      const html = getHTML();
      await Print.printAsync({ html });
    } catch (err) {
      // A user cancel on some Android builds throws — suppress it silently.
      const msg = err?.message ?? '';
      if (!msg.toLowerCase().includes('cancel')) {
        console.error('[Prescription] printAsync:', err);
        Alert.alert(
          'خطأ في الطباعة',
          'تعذّر فتح مربع الطباعة. يرجى المحاولة مجدداً.\n' +
          'Could not open the print dialog. Please try again.',
        );
      }
    } finally {
      setPrinting(false);
    }
  }, [getHTML]);

  // ── FlatList callbacks (stable references — never re-created on render) ─────
  const keyExtractor = useCallback((_item, index) => String(index), []);
  const renderItem = useCallback(
    ({ item, index }) => <MedicationCard item={item} index={index} />,
    [],
  );
  const listHeader = useMemo(
    () => <ListHeader encounter={encounter} rxNumber={rxNumber} />,
    [encounter, rxNumber],
  );
  const listEmpty = useMemo(() => <EmptyMedications />, []);
  const listSeparator = useCallback(
    () => <View style={S.itemSeparator} />,
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── MEDICATION LIST ─────────────────────────────────────────────────
          flex:1 — absorbs all space between the native stack header above
          and the CTA button row below. ItemSeparatorComponent keeps the
          list clean without adding marginBottom to each MedicationCard.
      ─────────────────────────────────────────────────────────────────── */}
      <FlatList
        style={S.list}
        contentContainerStyle={S.listContent}
        data={medications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ItemSeparatorComponent={listSeparator}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* ── CTA BUTTON ROW (fixed at bottom) ────────────────────────────────
          Two equal-width buttons: Share PDF and Print PDF.
          The row sits below the FlatList and above the safe-area bottom inset.
          Both buttons are disabled while any async operation is in flight.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={[S.ctaRow, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>

        {/* Share PDF */}
        <TouchableOpacity
          style={[S.ctaBtn, S.ctaBtnShare, busy && S.ctaBtnDisabled]}
          onPress={handleSharePDF}
          disabled={busy}
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="share-outline" size={20} color={Colors.white} />
          )}
          <Text style={S.ctaBtnText}>
            {generating ? 'جارٍ الإنشاء…' : 'مشاركة PDF'}
          </Text>
          {!generating && (
            <Text style={S.ctaBtnSub}>Share PDF</Text>
          )}
        </TouchableOpacity>

        {/* Print PDF */}
        <TouchableOpacity
          style={[S.ctaBtn, S.ctaBtnPrint, busy && S.ctaBtnDisabled]}
          onPress={handlePrintPDF}
          disabled={busy}
          activeOpacity={0.85}
        >
          {printing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="print-outline" size={20} color={Colors.primary} />
          )}
          <Text style={[S.ctaBtnText, S.ctaBtnTextPrint]}>
            {printing ? 'جارٍ الإعداد…' : 'طباعة'}
          </Text>
          {!printing && (
            <Text style={[S.ctaBtnSub, S.ctaBtnSubPrint]}>Print PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
// or positional left/right. Logical properties exclusively.
// Symmetric shorthands (paddingHorizontal, paddingVertical, gap) are fine.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root ───────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Medication FlatList ────────────────────────────────────────────────────
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  itemSeparator: {
    height: Spacing.sm,
  },

  // ── List header wrapper ────────────────────────────────────────────────────
  listHeader: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // ── Patient summary card ───────────────────────────────────────────────────
  patientCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    // Green accent stripe on the logical-start side (right in RTL, left in LTR)
    borderStartWidth: 4,
    borderStartColor: Colors.primary,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  patientRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  patientRowIcon: {
    width: 22,
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  patientLabel: {
    width: 64,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    flexShrink: 0,
    paddingTop: 1,
  },
  patientValue: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  patientValueDiag: {
    color: Colors.primary,
  },

  // ── Rx meta row (prescription # + date) ───────────────────────────────────
  rxMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  rxMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rxMetaText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── Medications section heading ────────────────────────────────────────────
  medsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  // Vertical green bar — borderStartWidth keeps it on the logical-start side.
  // Physical: left in LTR, right in RTL.
  medsHeadingBar: {
    width: 4,
    height: 18,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    flexShrink: 0,
  },
  medsHeadingText: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  medsCountBadge: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    flexShrink: 0,
  },
  medsCountText: {
    fontSize: FontSizes.xs,
    fontWeight: '800',
    color: Colors.primary,
  },

  // ── Medication card ────────────────────────────────────────────────────────
  medCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  // Number badge
  medIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  medIndexText: {
    fontSize: FontSizes.xs,
    fontWeight: '800',
    color: Colors.primary,
  },
  // Body
  medBody: {
    flex: 1,
    gap: Spacing.xs,
  },
  medDrug: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 22,
  },
  // Chips row
  medChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '12',
    borderRadius: 100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    gap: 4,
    flexShrink: 0,
  },
  chipText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Instructions
  medInstructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 2,
  },
  medInstructions: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── CTA button row ─────────────────────────────────────────────────────────
  // Fixed at the bottom of the screen, outside the FlatList.
  ctaRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  ctaBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: 3,
    minHeight: 68,
  },
  ctaBtnDisabled: {
    opacity: 0.60,
  },

  // Share PDF — filled green
  ctaBtnShare: {
    backgroundColor: Colors.primary,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
  },
  ctaBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '800',
    color: Colors.white,
  },
  ctaBtnSub: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },

  // Print PDF — outlined (ghost button)
  ctaBtnPrint: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ctaBtnTextPrint: {
    color: Colors.primary,
  },
  ctaBtnSubPrint: {
    color: Colors.primary + 'AA',
  },
});
