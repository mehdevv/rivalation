# House Structures Reference

This file documents the names and table structures of specific houses for reference.

## 1. Privé (House ID: 6)

### House Information
- **Name**: Privé
- **ID**: 6
- **Coordinates**: x: 152, y: 890
- **Type**: Section-based house with multiple sections

### Structure
This house uses a **sections** structure with 5 different sections.

#### Sections

##### 1. Photo / Video
- **Type**: Form section with fields
- **Fields**:
  - Training (type: `text`)
  - Group (type: `text`)
  - Date (type: `date`)

##### 2. Defense (Final Project)
- **Type**: Form section with fields
- **Fields**:
  - Training (type: `text`)
  - Group (type: `text`)

##### 3. Payment Report
- **Type**: Form section with fields
- **Fields**:
  - Training (type: `text`)
  - Group (type: `text`)
  - Payment % (type: `number`)

##### 4. Attendance Report
- **Type**: Form section with fields
- **Fields**:
  - Training (type: `text`)
  - Group (type: `text`)
  - Attendance % (type: `number`)

##### 5. Student Count
- **Type**: Form section with fields
- **Fields**:
  - Training (type: `text`)
  - Group (type: `text`)
  - Number (type: `number`)

### JSON Structure
```json
{
  "id": 6,
  "name": "Privé",
  "coordinates": {
    "x": 152,
    "y": 890
  },
  "sections": [
    {
      "name": "Photo / Video",
      "fields": [
        { "label": "Training", "type": "text" },
        { "label": "Group", "type": "text" },
        { "label": "Date", "type": "date" }
      ]
    },
    {
      "name": "Defense (Final Project)",
      "fields": [
        { "label": "Training", "type": "text" },
        { "label": "Group", "type": "text" }
      ]
    },
    {
      "name": "Payment Report",
      "fields": [
        { "label": "Training", "type": "text" },
        { "label": "Group", "type": "text" },
        { "label": "Payment %", "type": "number" }
      ]
    },
    {
      "name": "Attendance Report",
      "fields": [
        { "label": "Training", "type": "text" },
        { "label": "Group", "type": "text" },
        { "label": "Attendance %", "type": "number" }
      ]
    },
    {
      "name": "Student Count",
      "fields": [
        { "label": "Training", "type": "text" },
        { "label": "Group", "type": "text" },
        { "label": "Number", "type": "number" }
      ]
    }
  ]
}
```

### Game.js Mapping
```javascript
3: { 
  id: 6, 
  name: "Privé", 
  sections: [
    {
      name: "Photo / Video",
      fields: [
        { label: "Training", type: "text" },
        { label: "Group", type: "text" },
        { label: "Date", type: "date" }
      ]
    },
    {
      name: "Defense (Final Project)",
      fields: [
        { label: "Training", type: "text" },
        { label: "Group", type: "text" }
      ]
    },
    {
      name: "Payment Report",
      fields: [
        { label: "Training", type: "text" },
        { label: "Group", type: "text" },
        { label: "Payment %", type: "number" }
      ]
    },
    {
      name: "Attendance Report",
      fields: [
        { label: "Training", type: "text" },
        { label: "Group", type: "text" },
        { label: "Attendance %", type: "number" }
      ]
    },
    {
      name: "Student Count",
      fields: [
        { label: "Training", type: "text" },
        { label: "Group", type: "text" },
        { label: "Number", type: "number" }
      ]
    }
  ]
}
```

---

## 2. Médias & Statistiques (House ID: 8)

### House Information
- **Name**: Médias & Statistiques
- **ID**: 8
- **Coordinates**: x: 816, y: 1090
- **Type**: Table-based house

### Structure
This house uses a **table field** structure (not sections).

#### Fields
- **Missions** (type: `table`)
  - **Columns**: ["Mission 1", "Mission 2", "Mission 3", "..."]
  - **Description**: A table field for managing missions

### JSON Structure
```json
{
  "id": 8,
  "name": "Médias & Statistiques",
  "coordinates": {
    "x": 816,
    "y": 1090
  },
  "fields": [
    {
      "label": "Missions",
      "type": "table",
      "columns": ["Mission 1", "Mission 2", "Mission 3", "..."]
    }
  ]
}
```

### Game.js Mapping
```javascript
1: { 
  id: 8, 
  name: "Médias & Statistiques", 
  fields: [{ 
    label: "Missions", 
    type: "table", 
    columns: ["Mission 1", "Mission 2", "Mission 3", "..."] 
  }] 
}
```

---

## Notes

- **Privé** (ID: 6) uses a sections structure with 5 different sections
- **Médias & Statistiques** (ID: 8) uses a simple table field structure (no sections)
- Both houses are defined in:
  - `json file and img for houses tables/houses tables and inputs.json`
  - `game.js` in the `getHouseDataFromJSON()` function
- The coordinates represent the position on the map where the house interaction button appears

---

*Last Updated: Structures swapped - Privé now has sections, Médias & Statistiques now has table*

