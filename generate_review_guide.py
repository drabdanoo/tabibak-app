"""
Generate Tabibok Health App Review Guide PDF for Apple App Store reviewers.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.colors import HexColor, Color

# Brand colors
BRAND_GREEN = Color(16/255, 185/255, 129/255)          # #10b981
BRAND_GREEN_LIGHT = HexColor('#e6faf4')                 # light green bg
BRAND_GREEN_MID = Color(16/255, 185/255, 129/255, 0.15) # subtle tint
DARK_TEXT = HexColor('#1a1a2e')
BODY_TEXT = HexColor('#374151')
MUTED_TEXT = HexColor('#6b7280')
WHITE = colors.white
FOOTER_BG = HexColor('#f9fafb')

PAGE_W, PAGE_H = A4
MARGIN_LEFT = 2.2 * cm
MARGIN_RIGHT = 2.2 * cm
MARGIN_TOP = 2.5 * cm
MARGIN_BOTTOM = 2.5 * cm


# ── Custom Flowables ──────────────────────────────────────────────────────────

class GreenCircleNumber(Flowable):
    """A small green circle with a white number inside, used for step lists."""
    SIZE = 18

    def __init__(self, number):
        super().__init__()
        self.number = str(number)
        self.width = self.SIZE
        self.height = self.SIZE

    def draw(self):
        c = self.canv
        r = self.SIZE / 2
        c.setFillColor(BRAND_GREEN)
        c.circle(r, r, r, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(r, r - 3.5, self.number)


class SectionHeader(Flowable):
    """Section header: bold green text + thin green rule underneath."""
    def __init__(self, text, available_width):
        super().__init__()
        self.text = text
        self.available_width = available_width
        self.height = 28
        self.width = available_width

    def draw(self):
        c = self.canv
        c.setFont('Helvetica-Bold', 13)
        c.setFillColor(BRAND_GREEN)
        c.drawString(0, 12, self.text)
        c.setStrokeColor(BRAND_GREEN)
        c.setLineWidth(1.2)
        c.line(0, 7, self.available_width, 7)


# ── Footer / Header callback ──────────────────────────────────────────────────

def add_footer(canvas, doc):
    canvas.saveState()
    footer_text = "Tabibok Health \u2014 Confidential \u2014 For App Review Purposes Only"
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED_TEXT)
    canvas.drawCentredString(PAGE_W / 2, 1.4 * cm, footer_text)
    # thin rule above footer
    canvas.setStrokeColor(HexColor('#e5e7eb'))
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_LEFT, 1.8 * cm, PAGE_W - MARGIN_RIGHT, 1.8 * cm)
    # page number
    canvas.drawRightString(PAGE_W - MARGIN_RIGHT, 1.0 * cm,
                           f"Page {doc.page}")
    canvas.restoreState()


# ── Build content ─────────────────────────────────────────────────────────────

def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM + 1.2 * cm,  # room for footer
        title="Tabibok Health — App Review Guide",
        author="Tabibok / Vantaq",
        subject="Apple App Store Review Guide",
    )

    CONTENT_WIDTH = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT
    story = []

    # ── COVER BLOCK ──────────────────────────────────────────────────────────
    # Green header band simulated via a single-cell table
    cover_data = [[
        Paragraph(
            '<font color="#ffffff"><b>Tabibok Health</b></font>',
            ParagraphStyle('ch', fontName='Helvetica-Bold', fontSize=26,
                           leading=32, textColor=WHITE, alignment=TA_LEFT)
        )
    ]]
    cover_table = Table(cover_data, colWidths=[CONTENT_WIDTH])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BRAND_GREEN),
        ('TOPPADDING',    (0, 0), (-1, -1), 22),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 22),
        ('LEFTPADDING',   (0, 0), (-1, -1), 20),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 20),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 6))

    subtitle_style = ParagraphStyle(
        'Subtitle',
        fontName='Helvetica',
        fontSize=12,
        textColor=MUTED_TEXT,
        spaceAfter=4,
        alignment=TA_LEFT,
    )
    story.append(Paragraph("App Review Guide", ParagraphStyle(
        'GuideLabel', fontName='Helvetica-Bold', fontSize=18,
        textColor=DARK_TEXT, spaceBefore=10, spaceAfter=2
    )))
    story.append(Paragraph("For Apple App Store Review Team", subtitle_style))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width=CONTENT_WIDTH, thickness=0.5,
                            color=HexColor('#e5e7eb'), spaceAfter=12))

    # ── Helper styles ─────────────────────────────────────────────────────────
    body_style = ParagraphStyle(
        'Body', fontName='Helvetica', fontSize=10.5,
        leading=16, textColor=BODY_TEXT, spaceAfter=4
    )
    bullet_style = ParagraphStyle(
        'Bullet', fontName='Helvetica', fontSize=10.5,
        leading=16, textColor=BODY_TEXT, leftIndent=14,
        spaceAfter=3, bulletIndent=0
    )
    bold_label_style = ParagraphStyle(
        'BoldLabel', fontName='Helvetica-Bold', fontSize=10.5,
        leading=16, textColor=DARK_TEXT
    )
    sub_header_style = ParagraphStyle(
        'SubHeader', fontName='Helvetica-Bold', fontSize=11,
        textColor=DARK_TEXT, spaceBefore=8, spaceAfter=4
    )

    def section(title):
        story.append(Spacer(1, 0.5 * cm))
        story.append(SectionHeader(title, CONTENT_WIDTH))
        story.append(Spacer(1, 8))

    def bullet(text):
        story.append(Paragraph(f'\u2022\u2002{text}', bullet_style))

    def sub_bullet(text):
        story.append(Paragraph(
            f'\u2013\u2002{text}',
            ParagraphStyle('SubBullet', fontName='Helvetica', fontSize=10,
                           leading=15, textColor=BODY_TEXT, leftIndent=28,
                           spaceAfter=2)
        ))

    # ── SECTION 1 — App Overview ──────────────────────────────────────────────
    section("1.  App Overview")
    story.append(Paragraph(
        "Tabibok Health is a medical appointment booking platform designed for Iraq. "
        "It connects patients with doctors and supports clinic management through "
        "three distinct user roles.",
        body_style
    ))

    # ── SECTION 2 — User Roles ────────────────────────────────────────────────
    section("2.  User Roles")
    roles = [
        ("<b>Patient</b>", "Books appointments, chats with doctors, receives prescriptions. "
         "Signs in via Iraqi phone number (OTP)."),
        ("<b>Doctor</b>", "Manages appointments, issues prescriptions, updates profile. "
         "Signs in via email and password."),
        ("<b>Receptionist</b>", "Registers patients, manages walk-in bookings, handles notifications. "
         "Signs in via email and password."),
    ]
    for role_label, role_desc in roles:
        row_data = [[
            Paragraph(role_label, ParagraphStyle(
                'RoleLabel', fontName='Helvetica-Bold', fontSize=10.5,
                textColor=BRAND_GREEN, leading=15
            )),
            Paragraph(role_desc, body_style)
        ]]
        role_table = Table(row_data, colWidths=[3.2 * cm, CONTENT_WIDTH - 3.2 * cm])
        role_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(role_table)

    # ── SECTION 3 — Test Credentials ─────────────────────────────────────────
    section("3.  Test Credentials")
    story.append(Paragraph(
        "Use the following credentials to sign in and test the app:",
        body_style
    ))
    story.append(Spacer(1, 6))

    cred_header_style = ParagraphStyle(
        'CredHeader', fontName='Helvetica-Bold', fontSize=9.5,
        textColor=BRAND_GREEN, leading=14
    )
    cred_val_style = ParagraphStyle(
        'CredVal', fontName='Helvetica', fontSize=10,
        textColor=BODY_TEXT, leading=14
    )
    cred_bold_style = ParagraphStyle(
        'CredBold', fontName='Helvetica-Bold', fontSize=10,
        textColor=DARK_TEXT, leading=14
    )
    cred_note_style = ParagraphStyle(
        'CredNote', fontName='Helvetica-Oblique', fontSize=9.5,
        textColor=HexColor('#b45309'), leading=13
    )

    COL_W = [3.0 * cm, 5.8 * cm, 4.0 * cm, CONTENT_WIDTH - 12.8 * cm]

    cred_table_data = [
        # Header row
        [Paragraph("Role", cred_header_style),
         Paragraph("Email", cred_header_style),
         Paragraph("Password", cred_header_style),
         Paragraph("Notes", cred_header_style)],
        # Doctor
        [Paragraph("Doctor", cred_bold_style),
         Paragraph("doctor@test.com", cred_val_style),
         Paragraph("555555", cred_val_style),
         Paragraph("Full access", cred_val_style)],
        # Receptionist
        [Paragraph("Receptionist", cred_bold_style),
         Paragraph("receptionist@test.com", cred_val_style),
         Paragraph("555555", cred_val_style),
         Paragraph("Full access", cred_val_style)],
        # Patient
        [Paragraph("Patient", cred_bold_style),
         Paragraph("N/A", cred_val_style),
         Paragraph("N/A", cred_val_style),
         Paragraph(
             "NOT TESTABLE \u2014 requires a real Iraqi phone number (+964) for OTP SMS",
             cred_note_style
         )],
    ]

    cred_table = Table(cred_table_data, colWidths=COL_W)
    cred_table.setStyle(TableStyle([
        # outer border
        ('BOX',        (0, 0), (-1, -1), 1.0, BRAND_GREEN),
        # inner grid
        ('INNERGRID',  (0, 0), (-1, -1), 0.5, HexColor('#a7f3d0')),
        # header row bg
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        # data rows bg
        ('BACKGROUND', (0, 1), (-1, -1), BRAND_GREEN_LIGHT),
        # patient row slightly different
        ('BACKGROUND', (0, 3), (-1, 3), HexColor('#fffbeb')),
        # padding
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        # header text color override
        ('TEXTCOLOR',  (0, 0), (-1, 0), WHITE),
    ]))
    story.append(KeepTogether([cred_table]))

    # ── SECTION 4 — How to Log In ─────────────────────────────────────────────
    section("4.  How to Log In")
    steps = [
        "Open the app \u2014 the Role Selection screen appears",
        'Tap \u201cDoctor\u201d or \u201cReceptionist\u201d card',
        "Enter the email and password from the credentials above",
        'Tap \u201cSign In\u201d',
        "You will be taken to the role-specific dashboard",
    ]

    for i, step_text in enumerate(steps, 1):
        row = [[
            GreenCircleNumber(i),
            Paragraph(step_text, body_style)
        ]]
        step_table = Table(row, colWidths=[22, CONTENT_WIDTH - 22])
        step_table.setStyle(TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
            ('TOPPADDING',    (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(step_table)

    # ── SECTION 5 — Key Flows ─────────────────────────────────────────────────
    section("5.  Key Flows to Review")

    flows = {
        "Doctor Role": [
            ("Dashboard", "shows today's patients, pending requests, revenue analytics, weekly chart"),
            ("Appointments", "list of upcoming and past appointments"),
            ("Profile", "edit name, bio, photo upload, working hours"),
            ("Chat", "messaging with patients"),
        ],
        "Receptionist Role": [
            ("Dashboard", "today's appointments and patient queue"),
            ("Walk-in Booking", "book appointments for walk-in patients"),
            ("Patient Registration", "register new patients in the system"),
            ("Notifications", "view appointment alerts"),
        ],
        "Patient Role (cannot be tested by reviewer)": [
            (None, "Requires a real Iraqi phone number to receive OTP"),
            (None, "Once logged in: search doctors, view map, book appointments, receive prescriptions"),
        ],
    }

    for role_name, items in flows.items():
        story.append(Paragraph(role_name, sub_header_style))
        for label, desc in items:
            if label:
                story.append(Paragraph(
                    f'\u2022\u2002<b>{label}:</b>\u2002{desc}',
                    bullet_style
                ))
            else:
                story.append(Paragraph(f'\u2022\u2002{desc}', bullet_style))
        story.append(Spacer(1, 4))

    # ── SECTION 6 — Additional Notes ─────────────────────────────────────────
    section("6.  Additional Notes")
    notes = [
        "The app is fully bilingual (Arabic / English) \u2014 language follows the device\u2019s system language setting",
        "Authentication uses Firebase Auth; data is stored in Google Firestore",
        "Phone OTP authentication is only available on native iOS/Android builds (not web)",
        "No in-app purchases",
        "No advertisements",
        "No third-party advertising or tracking SDKs",
    ]
    for note in notes:
        bullet(note)

    # ── SECTION 7 — Contact ───────────────────────────────────────────────────
    section("7.  Contact")
    story.append(Spacer(1, 4))

    contact_data = [[
        Paragraph(
            'For any questions during review:\u2003<b>nudge@vantaq.net</b>',
            ParagraphStyle('ContactStyle', fontName='Helvetica', fontSize=11,
                           textColor=BODY_TEXT, leading=18)
        )
    ]]
    contact_table = Table(contact_data, colWidths=[CONTENT_WIDTH])
    contact_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), BRAND_GREEN_LIGHT),
        ('BOX',           (0, 0), (-1, -1), 1.0, BRAND_GREEN),
        ('TOPPADDING',    (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING',   (0, 0), (-1, -1), 16),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 16),
    ]))
    story.append(contact_table)

    story.append(Spacer(1, 1.0 * cm))

    # ── BUILD ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f"PDF created: {output_path}")


if __name__ == "__main__":
    build_pdf("G:/tabibak-app/AppReviewGuide.pdf")
