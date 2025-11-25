---
sidebar_position: 1
---

# Tutorial Overview

Welcome to the ReFormer tutorial! In this guide, you'll build a complete **Credit Application** form step by step.

:::info Work in Progress
This section is under development.
:::

## What You'll Learn

By the end of this tutorial, you will understand:

- How to define form schemas with TypeScript
- How to create reusable field components
- How to add validation (built-in, async, cross-field)
- How to implement behaviors (computed fields, conditional logic)
- How to handle form submission and server errors

## Prerequisites

- Basic knowledge of React and TypeScript
- ReFormer installed in your project

## Tutorial Structure

1. **Introduction** — Overview and form structure
2. **Preparation** — Create FormField and field components
3. **Form Schema** — Define interface, create schema, decompose into parts
4. **Rendering** — Build form components and steps
5. **Behaviors** — Add computed fields, conditional logic, and more
6. **Validation** — Implement all types of validation
7. **Data Flow** — Handle initialization and reset
8. **Submission** — Validate, transform, and submit data

## The Credit Application Form

Throughout this tutorial, we'll build a multi-step credit application form with 6 steps:

### Step 1: Basic Info

- Loan type (consumer, mortgage, car, business, refinancing)
- Loan amount and term
- Loan purpose
- Conditional fields for mortgage (property value, initial payment)
- Conditional fields for car loan (brand, model, year, price)

### Step 2: Personal Info

- Personal data (first name, last name, middle name, birth date, gender)
- Passport data (series, number, issue date, issued by)
- INN and SNILS

### Step 3: Contact Info

- Phone numbers (main, additional)
- Email addresses
- Registration address
- Residence address (with "same as registration" option)

### Step 4: Employment

- Employment status
- Company information (name, INN, phone, address)
- Position and work experience
- Income (monthly, additional)
- Business info for self-employed

### Step 5: Additional Info

- Marital status and dependents
- Education level
- Property (dynamic array)
- Existing loans (dynamic array)
- Co-borrowers (dynamic array)

### Step 6: Confirmation

- Personal data processing consent
- Credit history check consent
- Marketing consent
- Terms agreement
- Accuracy confirmation
- Electronic signature

### Computed Fields

- Interest rate (based on loan type and term)
- Monthly payment
- Full name
- Age (from birth date)
- Total income
- Payment to income ratio
- Co-borrowers total income

Let's get started!
