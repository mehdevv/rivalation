# Houses Data Documentation

This document provides detailed information about three houses and their associated buttons.

---

## 1. Centre d'Informations (ID: 5)

**Coordinates:** x: 782, y: 804

### Structure:
This house contains **4 sections** with different input fields.

### Sections and Fields:

#### Section 1: Seminar Info
- **Fields:**
  - Titles (text)
  - Start Time (time)
  - End Time (time)
  - Number of Participants (number)
  - Number of Certificates (number)

#### Section 2: Phone Info
- **Fields:**
  - Training (text)
  - Group (text)
  - Session (select: "1st", "2nd", "3rd", "...")

#### Section 3: Entry Type
- **Conditional Groups:**
  - **Condition: voucher**
    - Remaining Vouchers (number)
    - Vouchers Entered (number)
  - **Condition: registration_form**
    - Remaining Forms (number)
    - Forms Entered (number)
  - **Condition: diploma**
    - Remaining Diplomas (number)
    - Diplomas Entered (number)

#### Section 4: Hygiene
- **Fields:**
  - District (text)
  - Province (text)
  - Completed by (text)
  - Percentage (number)

### Associated Buttons (from CSV):
- **Séminaire** → Maps to "Seminar Info" section
  - Inputs: Titres, Heure de Départ / Fin, N° de Participants, N° d'attestations
- **Tel** → Maps to "Phone Info" section
  - Inputs: Formation, Grp, 1er Séance, 2éme Séance, 3éme Séance
- **Saisie** → Maps to "Entry Type" section
  - Sub-buttons:
    - Bon → Bons Reste, Bons Saisie
    - Fiche D'inscription → Fiche Reste, Fiche Saisie
    - Diplôme → Dip Reste, Dip Saisie
- **Hygiene** → Maps to "Hygiene" section
  - Inputs: Targa / Wilaya, Fait par "Player", Pourcentage (50-75-100)

---

## 2. Gestion Administrative (ID: 4)

**Coordinates:** x: 794, y: 516

### Structure:
This house contains **4 sections** with different input fields.

### Sections and Fields:

#### Section 1: Diploma
- **Fields:**
  - First Name (text)
  - Last Name (text)
  - Phone Number (text)
  - Training (text)

#### Section 2: Registration Form
- **Fields:**
  - First Name (text)
  - Last Name (text)
  - Phone Number (text)
  - Training (text)

#### Section 3: Pre-Registration
- **Fields:**
  - First Name (text)
  - Last Name (text)
  - Phone Number (text)
  - Training (text)
  - Province (text)
  - District (text)
  - Facebook (text)

#### Section 4: Cash Register
- **Fields:**
  - Cash Fund (number)
  - Vouchers (number)
  - Expenses (number)

### Associated Buttons (from CSV):
- **Fiche D'inscription** → Maps to "Registration Form" section
  - Inputs: Nom Prénom, N° Tel, Formation
- **Pré-inscription** → Maps to "Pre-Registration" section
  - Inputs: Nom Prénom, N° Tel, Wilaya / Targa / FB, Formation
- **Caisse** → Maps to "Cash Register" section
  - Inputs: Fond de Caisse, Bons, Dépense

**Note:** The "Diploma" section does not have a direct button in the CSV, but it's part of the house structure.

---

## 3. Gestion d'Activités (ID: 2)

**Coordinates:** x: 36, y: 426

### Structure:
This house contains **2 readonly sections** (display-only views).

### Sections:

#### Section 1: Tasks
- **Type:** Readonly
- **Description:** Read-only view
- **Purpose:** Displays tasks information

#### Section 2: Feedback
- **Type:** Readonly
- **Description:** Read-only view
- **Purpose:** Displays feedback information

### Associated Buttons (from CSV):
- **Taches** → Maps to "Tasks" section
  - Type: Lecture (Read-only)
- **FeedBack** → Maps to "Feedback" section
  - Type: Lecture (Read-only)

---

## Summary Table

| House Name | ID | Coordinates | Sections Count | Buttons Count |
|------------|----|-------------|----------------|---------------|
| Centre d'Informations | 5 | (782, 804) | 4 | 4 (Séminaire, Tel, Saisie, Hygiene) |
| Gestion Administrative | 4 | (794, 516) | 4 | 3 (Fiche D'inscription, Pré-inscription, Caisse) |
| Gestion d'Activités | 2 | (36, 426) | 2 | 2 (Taches, FeedBack) |

---

## Button-to-Section Mapping

### Centre d'Informations (ID: 5)
- Séminaire → Seminar Info
- Tel → Phone Info
- Saisie → Entry Type (with conditional sub-buttons)
- Hygiene → Hygiene

### Gestion Administrative (ID: 4)
- Fiche D'inscription → Registration Form
- Pré-inscription → Pre-Registration
- Caisse → Cash Register

### Gestion d'Activités (ID: 2)
- Taches → Tasks (readonly)
- FeedBack → Feedback (readonly)

---

*Last Updated: Based on current JSON structure and CSV button mappings*

