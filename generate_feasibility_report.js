import fs from 'fs';
import path from 'path';

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير الجدوى المالية والوفر المتوقع - شركة المدارس المتقدمة التعليمية</title>
  
  <!-- Google Fonts: Cairo & Tajawal -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary-navy: #091326;
      --navy-deep: #050b17;
      --navy-card: #0f1f3d;
      --royal-blue: #1d4ed8;
      --blue-accent: #2563eb;
      --blue-light: #eff6ff;
      --blue-glow: #38bdf8;
      --gold-primary: #b45309;
      --gold-vibrant: #d97706;
      --gold-light: #fef3c7;
      --gold-badge: #fbbf24;
      --gold-metallic: linear-gradient(135deg, #d97706 0%, #fbbf24 50%, #b45309 100%);
      --emerald-dark: #064e3b;
      --emerald-accent: #059669;
      --emerald-light: #d1fae5;
      --emerald-vibrant: #10b981;
      --purple-accent: #6d28d9;
      --purple-light: #ede9fe;
      --rose-accent: #be123c;
      --rose-light: #ffe4e6;
      --text-dark: #0f172a;
      --text-muted: #475569;
      --text-light: #94a3b8;
      --border-soft: #e2e8f0;
      --bg-page: #f8fafc;
      --white: #ffffff;
      --shadow-sm: 0 2px 8px rgba(0,0,0,0.04);
      --shadow-md: 0 6px 20px rgba(0,0,0,0.06);
      --shadow-lg: 0 14px 34px rgba(0,0,0,0.1);
      --shadow-gold: 0 8px 24px rgba(217, 119, 6, 0.22);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      background-color: var(--bg-page);
      color: var(--text-dark);
      line-height: 1.75;
      padding: 24px;
      direction: rtl;
    }

    .container {
      max-width: 1260px;
      margin: 0 auto;
    }

    /* Print & Quick Actions Header */
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--border-soft);
      border-radius: 14px;
      padding: 12px 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
      flex-wrap: wrap;
      gap: 12px;
    }

    .action-bar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .doc-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #eff6ff;
      color: #1e40af;
      padding: 6px 14px;
      border-radius: 30px;
      font-size: 9.5pt;
      font-weight: 800;
      border: 1px solid #bfdbfe;
    }

    .btn-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .btn-action {
      background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
      color: #ffffff;
      border: none;
      padding: 9px 20px;
      border-radius: 9px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 9.5pt;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.28);
      text-decoration: none;
    }

    .btn-action:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4);
    }

    .btn-gold {
      background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
      box-shadow: 0 4px 14px rgba(217, 119, 6, 0.28);
    }

    .btn-gold:hover {
      box-shadow: 0 6px 20px rgba(217, 119, 6, 0.4);
    }

    /* Executive Hero Banner */
    .hero-banner {
      background: linear-gradient(135deg, #030712 0%, #0a1329 45%, #11224d 100%);
      border: 2px solid #20335e;
      border-radius: 24px;
      padding: 38px 44px;
      color: #ffffff;
      position: relative;
      overflow: hidden;
      margin-bottom: 28px;
      box-shadow: 0 20px 45px rgba(3, 7, 18, 0.28);
    }

    .hero-banner::before {
      content: '';
      position: absolute;
      top: -90px;
      left: -90px;
      width: 360px;
      height: 360px;
      background: radial-gradient(circle, rgba(2, 132, 199, 0.28) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-banner::after {
      content: '';
      position: absolute;
      bottom: -90px;
      right: -90px;
      width: 380px;
      height: 380px;
      background: radial-gradient(circle, rgba(217, 119, 6, 0.22) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }

    .brand-box {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .brand-logo-seal {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: #ffffff;
      padding: 3px;
      border: 2.5px solid #fbbf24;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .brand-logo-seal img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 50%;
    }

    .brand-titles h3 {
      font-size: 13.5pt;
      font-weight: 900;
      color: #fde047;
      letter-spacing: 0.3px;
    }

    .brand-titles p {
      font-size: 9.5pt;
      color: #cbd5e1;
    }

    .classification-tag {
      background: rgba(217, 119, 6, 0.25);
      border: 1.5px solid #f59e0b;
      color: #fde047;
      padding: 6px 18px;
      border-radius: 30px;
      font-size: 9.5pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .main-title {
      font-size: 22pt;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 12px;
      line-height: 1.45;
      text-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }

    .main-title span.gold-text {
      color: #fde047;
      background: linear-gradient(90deg, #fde047, #f59e0b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .sub-title {
      font-size: 11pt;
      color: #e2e8f0;
      margin-bottom: 24px;
      max-width: 1060px;
      line-height: 1.75;
    }

    /* Executive Dedication Box */
    .dedication-card {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(14px);
      border: 1.5px solid rgba(253, 224, 71, 0.45);
      border-radius: 16px;
      padding: 20px 26px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
    }

    .dedication-icon {
      font-size: 30pt;
      background: rgba(217, 119, 6, 0.25);
      border: 1.5px solid #f59e0b;
      width: 68px;
      height: 68px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 15px rgba(217, 119, 6, 0.2);
    }

    .dedication-content span.to-label {
      display: block;
      color: #fde047;
      font-size: 10pt;
      font-weight: 800;
      margin-bottom: 3px;
    }

    .dedication-content strong.to-person {
      display: block;
      font-size: 15.5pt;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.35;
    }

    .dedication-content p.to-sub {
      color: #cbd5e1;
      font-size: 9.5pt;
      margin-top: 4px;
      line-height: 1.5;
    }

    /* Innovation Callout */
    .innovation-banner {
      background: rgba(2, 132, 199, 0.15);
      border-right: 4px solid #38bdf8;
      border-radius: 10px;
      padding: 14px 20px;
      margin-top: 20px;
      font-size: 10pt;
      color: #e0f2fe;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    /* Top KPI Savings Dashboard */
    .kpi-savings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid var(--border-soft);
      border-radius: 18px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: all 0.25s ease;
    }

    .kpi-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 5px;
    }

    .kpi-emerald::before { background: linear-gradient(90deg, #059669, #34d399); }
    .kpi-gold::before { background: linear-gradient(90deg, #d97706, #fbbf24); }
    .kpi-blue::before { background: linear-gradient(90deg, #1d4ed8, #38bdf8); }
    .kpi-purple::before { background: linear-gradient(90deg, #6d28d9, #c084fc); }

    .kpi-tag {
      display: inline-block;
      font-size: 8.5pt;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 12px;
    }

    .tag-emerald { background: #d1fae5; color: #065f46; }
    .tag-gold { background: #fef3c7; color: #92400e; }
    .tag-blue { background: #e0f2fe; color: #0369a1; }
    .tag-purple { background: #ede9fe; color: #5b21b6; }

    .kpi-number {
      font-size: 23pt;
      font-weight: 900;
      color: var(--text-dark);
      line-height: 1.15;
      margin-bottom: 6px;
      font-family: inherit;
    }

    .kpi-number span.unit {
      font-size: 11pt;
      font-weight: 700;
      color: var(--text-muted);
    }

    .kpi-desc {
      font-size: 9.3pt;
      color: #64748b;
      line-height: 1.55;
    }

    /* Content Cards & Sections */
    .section-box {
      background: #ffffff;
      border: 1px solid var(--border-soft);
      border-radius: 18px;
      padding: 28px 32px;
      margin-bottom: 26px;
      box-shadow: var(--shadow-sm);
    }

    .section-title-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 16px;
      margin-bottom: 22px;
    }

    .section-icon-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18pt;
      flex-shrink: 0;
    }

    .icon-emerald { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .icon-blue { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .icon-gold { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .icon-purple { background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; }

    .section-title-wrap h2 {
      font-size: 14.5pt;
      font-weight: 900;
      color: #0f172a;
    }

    .section-title-wrap p {
      font-size: 9.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    /* Interactive Calculator Section */
    .calc-container {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 2px solid #cbd5e1;
      border-radius: 16px;
      padding: 26px;
      margin: 18px 0;
    }

    .calc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 12px;
    }

    .calc-header h3 {
      font-size: 12pt;
      font-weight: 800;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .calc-badge {
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 8.5pt;
      font-weight: 800;
    }

    .calc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 22px;
    }

    .calc-input-group {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.02);
    }

    .calc-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .calc-label-row label {
      font-size: 9.5pt;
      font-weight: 800;
      color: #1e293b;
    }

    .calc-val-badge {
      font-size: 10pt;
      font-weight: 900;
      color: #0284c7;
      background: #e0f2fe;
      padding: 2px 10px;
      border-radius: 8px;
    }

    .calc-slider {
      width: 100%;
      height: 7px;
      border-radius: 5px;
      background: #e2e8f0;
      outline: none;
      accent-color: #0284c7;
      cursor: pointer;
    }

    .calc-results-bar {
      background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f766e 100%);
      color: #ffffff;
      border-radius: 14px;
      padding: 20px 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      box-shadow: 0 10px 24px rgba(6, 78, 59, 0.25);
    }

    .calc-res-item {
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      padding-left: 16px;
    }

    .calc-res-item:last-child {
      border-left: none;
    }

    .calc-res-item span {
      display: block;
      font-size: 8.5pt;
      color: #a7f3d0;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .calc-res-item strong {
      display: block;
      font-size: 16pt;
      font-weight: 900;
      color: #fde047;
      line-height: 1.25;
    }

    .calc-res-item small {
      font-size: 7.5pt;
      color: #e2e8f0;
    }

    /* Comparison Data Tables */
    .table-responsive {
      overflow-x: auto;
      border-radius: 14px;
      border: 1px solid var(--border-soft);
      margin: 18px 0;
    }

    .styled-table {
      width: 100%;
      border-collapse: collapse;
      text-align: right;
      font-size: 9.5pt;
    }

    .styled-table thead tr {
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
    }

    .styled-table th {
      padding: 14px 18px;
      color: #334155;
      font-weight: 900;
      white-space: nowrap;
    }

    .styled-table td {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }

    .styled-table tr:hover {
      background-color: #f8fafc;
    }

    .styled-table tr.highlight-total {
      background: #ecfdf5 !important;
      font-weight: 800;
    }

    .styled-table td.danger-cell {
      color: #dc2626;
      font-weight: 800;
    }

    .styled-table td.success-cell {
      color: #059669;
      font-weight: 900;
    }

    .styled-table td.highlight-cell {
      color: #1e40af;
      font-weight: 800;
    }

    /* Visual Pillar Cards */
    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
      margin: 18px 0;
    }

    .pillar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
      border-top: 4px solid #1e3a8a;
    }

    .pillar-card.border-emerald { border-top-color: #059669; }
    .pillar-card.border-gold { border-top-color: #d97706; }
    .pillar-card.border-purple { border-top-color: #7c3aed; }
    .pillar-card.border-cyan { border-top-color: #0284c7; }

    .pillar-card h4 {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pillar-card p {
      font-size: 9.3pt;
      color: #475569;
      line-height: 1.6;
    }

    .pillar-card .pillar-saving {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #e2e8f0;
      font-size: 8.8pt;
      font-weight: 800;
      color: #047857;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Multi-Year Chart Representation */
    .chart-container {
      background: #0f172a;
      color: #ffffff;
      border-radius: 16px;
      padding: 24px;
      margin: 20px 0;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #334155;
      padding-bottom: 12px;
    }

    .chart-title {
      font-size: 11.5pt;
      font-weight: 800;
      color: #38bdf8;
    }

    .chart-legend {
      display: flex;
      gap: 16px;
      font-size: 8.5pt;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .box-red { background: #ef4444; }
    .box-green { background: #10b981; }

    .bars-row {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .bar-group {
      display: grid;
      grid-template-columns: 100px 1fr;
      align-items: center;
      gap: 12px;
    }

    .bar-label {
      font-size: 9pt;
      font-weight: 700;
      color: #cbd5e1;
    }

    .bar-track {
      background: #1e293b;
      border-radius: 6px;
      height: 38px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      padding: 4px 6px;
      position: relative;
    }

    .bar-fill-red {
      background: linear-gradient(90deg, #ef4444, #f87171);
      height: 13px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-left: 6px;
      font-size: 7.5pt;
      font-weight: 800;
      color: #ffffff;
      transition: width 0.8s ease;
    }

    .bar-fill-green {
      background: linear-gradient(90deg, #10b981, #34d399);
      height: 13px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-left: 6px;
      font-size: 7.5pt;
      font-weight: 800;
      color: #ffffff;
      transition: width 0.8s ease;
    }

    /* 3 Institutional Handover Pillars */
    .readiness-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 22px;
      margin-top: 20px;
    }

    .readiness-card {
      border-radius: 16px;
      padding: 26px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.25s ease;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      box-shadow: 0 4px 14px rgba(0,0,0,0.03);
    }

    .readiness-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.07);
    }

    .card-sovereignty {
      border-top: 5px solid #10b981;
      background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
    }

    .card-training {
      border-top: 5px solid #0284c7;
      background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
    }

    .card-support {
      border-top: 5px solid #6d28d9;
      background: linear-gradient(180deg, #faf5ff 0%, #ffffff 100%);
    }

    .readiness-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20pt;
      margin-bottom: 14px;
    }

    .icon-box-emerald { background: #d1fae5; color: #047857; }
    .icon-box-blue { background: #e0f2fe; color: #0284c7; }
    .icon-box-purple { background: #ede9fe; color: #6d28d9; }

    .readiness-title {
      font-size: 13pt;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .readiness-sub {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 16px;
      line-height: 1.6;
    }

    .readiness-list {
      list-style: none;
      margin-bottom: 20px;
      font-size: 9.3pt;
    }

    .readiness-list li {
      margin-bottom: 10px;
      position: relative;
      padding-right: 22px;
      color: #334155;
      line-height: 1.55;
    }

    .readiness-list li::before {
      content: '✔';
      position: absolute;
      right: 0;
      color: #059669;
      font-weight: 900;
    }

    .readiness-footer-badge {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 8.5pt;
      font-weight: 800;
      text-align: center;
    }

    /* Executive Signature Box */
    .signature-card {
      background: linear-gradient(135deg, #090e17 0%, #0f172a 45%, #1e1b4b 100%);
      border: 2px solid #38bdf8;
      border-radius: 20px;
      padding: 30px 36px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 24px;
      margin-top: 30px;
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
    }

    .sig-person-group {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .sig-avatar {
      font-size: 32pt;
      background: rgba(255, 255, 255, 0.08);
      border: 2px solid #38bdf8;
      width: 74px;
      height: 74px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(56, 189, 248, 0.3);
    }

    .sig-details span.role-title {
      display: block;
      color: #38bdf8;
      font-size: 9.5pt;
      font-weight: 800;
      margin-bottom: 2px;
    }

    .sig-details strong.author-name {
      display: block;
      font-size: 16.5pt;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.3;
    }

    .sig-details p.author-desc {
      color: #cbd5e1;
      font-size: 9.5pt;
      margin-top: 3px;
    }

    .sig-endorsement-pill {
      background: rgba(255, 255, 255, 0.06);
      border-right: 3px solid #10b981;
      padding: 6px 14px;
      border-radius: 6px;
      margin-top: 8px;
      font-size: 8.8pt;
      color: #a7f3d0;
      display: inline-block;
    }

    .sig-contact-block {
      background: rgba(255, 255, 255, 0.08);
      border: 1.5px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      padding: 16px 24px;
      text-align: center;
      min-width: 260px;
    }

    .sig-contact-block .phone-label {
      font-size: 8.5pt;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .sig-contact-block .phone-num {
      font-size: 17pt;
      font-weight: 900;
      color: #fde047;
      direction: ltr;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      letter-spacing: 1px;
    }

    .demo-ready-badge {
      font-size: 8pt;
      color: #38bdf8;
      margin-top: 6px;
      font-weight: 700;
    }

    /* Print Optimization */
    @media print {
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
        color: #000000 !important;
        font-size: 9pt !important;
      }
      .action-bar { display: none !important; }
      .container { max-width: 100% !important; margin: 0 !important; }
      .hero-banner {
        background: #091326 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-after: avoid;
        padding: 20px !important;
      }
      .section-box {
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        page-break-inside: avoid;
        margin-bottom: 14px !important;
        padding: 16px !important;
      }
      .styled-table th {
        background: #f1f5f9 !important;
        -webkit-print-color-adjust: exact !important;
      }
      .readiness-card {
        page-break-inside: avoid;
      }
      .signature-card {
        background: #091326 !important;
        -webkit-print-color-adjust: exact !important;
        page-break-inside: avoid;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>

  <div class="container">

    <!-- Top Action Bar -->
    <div class="action-bar">
      <div class="action-bar-right">
        <div class="doc-pill">
          <span>🏛️ شركة المدارس المتقدمة التعليمية</span>
        </div>
        <span style="font-size: 9pt; color: #64748b; font-weight: 700;">
          وثيقة دراسة الجدوى المالية والوفر السنوي المتوقع لشبكة المدارس (40+ مجمع)
        </span>
      </div>
      <div class="btn-group">
        <a href="#interactive-calculator" class="btn-action btn-gold">
          <span>🧮 حاسبة الوفر التفاعلية المباشرة</span>
        </a>
        <button class="btn-action" onclick="window.print()">
          <span>🖨️ طباعة التقرير أو حفظه كـ PDF رسمي</span>
        </button>
      </div>
    </div>

    <!-- Executive Hero Header -->
    <div class="hero-banner">
      <div class="hero-top">
        <div class="brand-box">
          <div class="brand-logo-seal">
            <img src="./motaqadimah_logo.png" alt="شعار شركة المدارس المتقدمة" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><circle cx=\\'50\\' cy=\\'50\\' r=\\'45\\' fill=\\'%230284c7\\'/><text x=\\'50\\' y=\\'55\\' font-size=\\'30\\' text-anchor=\\'middle\\' fill=\\'white\\'>M</text></svg>'">
          </div>
          <div class="brand-titles">
            <h3>شركة المدارس المتقدمة التعليمية (Al-Motaqadimah Schools)</h3>
            <p>تأسست 1416 هـ • صرح تعليمي رائد • « جيل ينتج المعرفة »</p>
          </div>
        </div>

        <div class="classification-tag">
          <span>🔒 وثيقة جدوى مالية واستراتيجية رفيعة المستوى 1447 / 1448 هـ</span>
        </div>
      </div>

      <h1 class="main-title">
        تقرير الجدوى المالية الشامل والمحدث: <span class="gold-text">الوفر المالي الحقيقي المتوقع</span> لتملك وتوطين المنظومة التعليمية الذكية لشبكة الـ 40+ مدرسة
      </h1>

      <p class="sub-title">
        دراسة قياسية محاسبية واقتصادية دقيقة تثبت بالأرقام الموثقة كيف تحقق المنظومة وفراً مالياً نقدياً ومباشراً يتجاوز <strong>3.2 إلى 4.5 مليون ريال سنوياً</strong>، وتوقف نزيف عقود البرمجيات كخدمة (SaaS) المستأجرة، مع تحويل تقنية التعليم من "مركز تكلفة مستنزف" إلى "أصل رقمي رأسمالي حر" مملوك للشركة مدى الحياة.
      </p>

      <!-- Dedication Card -->
      <div class="dedication-card">
        <div class="dedication-icon">👑</div>
        <div class="dedication-content">
          <span class="to-label">مرفوع بكل إجلال وعرفان واعتزاز لمقام الأب والمعلم الأول:</span>
          <strong class="to-person">سعادة رئيس مجلس إدارة شركة المدارس المتقدمة التعليمية الدكتور / عبدالرحمن بن سعد الحقباني</strong>
          <p class="to-sub">
            حفظه الله ورعاه — رائد التعليم الأهلي والذكي بالمملكة، وصاحب الرؤية الثاقبة في تمكين كفاءات وأبناء المدارس المتقدمة من قيادة التحول وصناعة المستقبل.
          </p>
        </div>
      </div>

      <!-- Innovation Note -->
      <div class="innovation-banner">
        <span style="font-size: 16pt;">💡</span>
        <span>
          <strong>مبادرة ابتكار داخلي من صلب الميدان التعليمي:</strong> تجسد هذه المنظومة مبادرة تقنية وتربوية استثنائية صممها وطورها أحد معلمي الشركة بمجمع التعلم الذكي بجدة، مستلهمة استراتيجية <strong>«الحقبنة التربوية»</strong> المعتمدة في ربط المعارف بالقيم والخبرات، لتكون أول منظومة سعودية متكاملة 100% تحقق الاكتفاء الذاتي والاستقلالية السيادية لشركة المدارس المتقدمة.
        </span>
      </div>
    </div>

    <!-- 4 Headline KPI Cards -->
    <div class="kpi-savings-grid">
      <div class="kpi-card kpi-emerald">
        <span class="kpi-tag tag-emerald">الوفر المالي السنوي المباشر</span>
        <div class="kpi-number">+3,200,000 <span class="unit">ريال / سنوياً</span></div>
        <div class="kpi-desc">وفر نقدي مؤكد ناتج عن وقف رسوم تراخيص الـ LMS، والرسائل النصية SMS، ومطبوعات أوراق العمل.</div>
      </div>

      <div class="kpi-card kpi-gold">
        <span class="kpi-tag tag-gold">الوفر التراكمي خلال 5 سنوات</span>
        <div class="kpi-number">+16,500,000 <span class="unit">ريال سعودي</span></div>
        <div class="kpi-desc">إجمالي المبالغ المستردة والمحفوظة في خزينة الشركة مقارنة بعقود التجديد التراكمية للمنصات التجارية.</div>
      </div>

      <div class="kpi-card kpi-blue">
        <span class="kpi-tag tag-blue">عائد استثماري فوري للشركة</span>
        <div class="kpi-number">عائد لحظي <span class="unit">Instant ROI</span></div>
        <div class="kpi-desc">وفر مالي مباشر يبدأ من اليوم الأول للتشغيل؛ لانعدام أي رسوم تراخيص أو وسائط برمجية خارجية.</div>
      </div>

      <div class="kpi-card kpi-purple">
        <span class="kpi-tag tag-purple">طبيعة وقيمة الأصل الرقمي</span>
        <div class="kpi-number">أصل رأسمالي <span class="unit">100% IP</span></div>
        <div class="kpi-desc">ملكية فكرية مطلقة للشركة ترفع التقييم المؤسسي للقوائم المالية، وقابلة للترخيص التجاري لمدارس أخرى.</div>
      </div>
    </div>

    <!-- Section 1: Executive Rationale (Rent vs Own) -->
    <div class="section-box">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-blue">⚖️</div>
        <div>
          <h2>1. المعضلة المالية الحالية: استنزاف عقود الإيجار (Rent) مقابل سيادة التملك المؤسسي (Own)</h2>
          <p>تحليل العبء المالي الواقع على مجموعة المدارس المتقدمة جراء الاعتماد على شركات البرمجيات الخارجية</p>
        </div>
      </div>

      <p style="font-size: 10pt; color: #334155; margin-bottom: 16px;">
        تدير شركة المدارس المتقدمة التعليمية صرحاً تعليمياً عملاقاً يضم <strong>أكثر من 40 مدرسة ومجمعاً تعليمياً</strong> ونحو <strong>35,000 إلى 45,000 طالب وطالبة</strong>. في نموذج التشغيل التقليدي المعتمد على منصات البرمجيات كخدمة (SaaS) مثل كلاسيرا (Classera) أو إديوويف أو بلاك بورد، تدفع الشركة فاتورة مركبة تتصاعد سنوياً:
      </p>

      <div class="pillars-grid">
        <div class="pillar-card border-gold">
          <h4>💸 1. فخ رسوم "الدفع لكل طالب" (Per-Student Trap)</h4>
          <p>تفرض الشركات التجارية رسماً سنوياً يتراوح بين 35 إلى 75 ريالاً لكل طالب مسجل، أو عقداً مقطوعاً يتراوح بين 45,000 إلى 75,000 ريال لكل مجمع. كلما زاد نجاح المتقدمة وتوسعت في جذب الطلاب، تضاعفت فاتورة البرمجيات دون أي عائد ملكية.</p>
          <div class="pillar-saving">
            <span>التكلفة الحالية لـ 40 مدرسة:</span>
            <span style="color: #dc2626;">1.8M - 2.5M ريال سنوياً</span>
          </div>
        </div>

        <div class="pillar-card border-cyan">
          <h4>📱 2. استنزاف رسائل الـ SMS والإشعارات</h4>
          <p>تعتمد المدارس على بوابات SMS لإرسال إشعارات الحضور والغياب، الخطط الأسبوعية، ونتائج الاختبارات. مع إرسال 50 إلى 80 رسالة لكل طالب سنوياً، تبتلع شركات الاتصالات مئات الآلاف من الريالات دون داعٍ.</p>
          <div class="pillar-saving">
            <span>التكلفة الحالية لـ 40 مدرسة:</span>
            <span style="color: #dc2626;">200,000 - 280,000 ريال سنوياً</span>
          </div>
        </div>

        <div class="pillar-card border-purple">
          <h4>🖨️ 3. هدر أوراق العمل والطباعة ومحابر التصوير</h4>
          <p>تعتمد المنصات التقليدية على تصدير ملفات PDF صامتة، مما يجبر المعلمين على طباعة مئات الآلاف من أوراق العمل والاختبارات التشخيصية ورقياً، مع استنزاف هائل للورق والمحابر وتأجير الآلات.</p>
          <div class="pillar-saving">
            <span>التكلفة الحالية لـ 40 مدرسة:</span>
            <span style="color: #dc2626;">500,000 - 850,000 ريال سنوياً</span>
          </div>
        </div>

        <div class="pillar-card border-emerald">
          <h4>🔒 4. انعدام القيمة الرأسمالية (Zero Asset Value)</h4>
          <p>بعد سداد 10 إلى 15 مليون ريال خلال 5 سنوات لمزودي البرمجيات الخارجيين، لا تمتلك الشركة سطراً برمجياً واحداً، وتظل رهينة لقرارات المزود وسياساته التسعيرية، بينما التملك يبني <strong>أصلاً رقمياً سيادياً مسجلاً</strong>.</p>
          <div class="pillar-saving">
            <span>الأصل المتراكم بعد 5 سنوات:</span>
            <span style="color: #dc2626;">صفر ريال (خسارة تامة)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Interactive Dynamic Calculator -->
    <div class="section-box" id="interactive-calculator">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-gold">🧮</div>
        <div>
          <h2>2. حاسبة الوفر المالي الديناميكية التفاعلية لسعادة رئيس مجلس الإدارة</h2>
          <p>لوحة تفاعلية حية تتيح تعديل المعطيات واحتساب الوفر المالي الفعلي المتوقع لحظياً</p>
        </div>
      </div>

      <div class="calc-container">
        <div class="calc-header">
          <h3><span>⚡</span> محاكي الجدوى التفاعلي لشركة المدارس المتقدمة</h3>
          <span class="calc-badge">حساب فوري مباشر</span>
        </div>

        <div class="calc-grid">
          <!-- Input 1: Schools Count -->
          <div class="calc-input-group">
            <div class="calc-label-row">
              <label for="schoolsRange">عدد المدارس والمجمعات التابعة:</label>
              <span class="calc-val-badge" id="schoolsVal">40 مدرسة</span>
            </div>
            <input type="range" class="calc-slider" id="schoolsRange" min="10" max="60" value="40" step="1" oninput="updateCalculations()">
            <div style="display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; margin-top: 4px;">
              <span>10 مجمعات</span>
              <span>40 مجمعاً (الحالي)</span>
              <span>60 مجمعاً</span>
            </div>
          </div>

          <!-- Input 2: Students Count -->
          <div class="calc-input-group">
            <div class="calc-label-row">
              <label for="studentsRange">إجمالي عدد الطلاب والطالبات:</label>
              <span class="calc-val-badge" id="studentsVal">35,000 طالب</span>
            </div>
            <input type="range" class="calc-slider" id="studentsRange" min="10000" max="70000" value="35000" step="1000" oninput="updateCalculations()">
            <div style="display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; margin-top: 4px;">
              <span>10,000</span>
              <span>35,000 (المتوسط)</span>
              <span>70,000</span>
            </div>
          </div>

          <!-- Input 3: LMS Annual Fee per Student -->
          <div class="calc-input-group">
            <div class="calc-label-row">
              <label for="lmsFeeRange">تكلفة اشتراك كلاسيرا/الطالب سنوياً:</label>
              <span class="calc-val-badge" id="lmsFeeVal">55 ريال</span>
            </div>
            <input type="range" class="calc-slider" id="lmsFeeRange" min="30" max="90" value="55" step="5" oninput="updateCalculations()">
            <div style="display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; margin-top: 4px;">
              <span>30 ريال</span>
              <span>55 ريال (المعتاد)</span>
              <span>90 ريال</span>
            </div>
          </div>

          <!-- Input 4: Printing Cost per School Monthly -->
          <div class="calc-input-group">
            <div class="calc-label-row">
              <label for="printRange">متوسط مصاريف الطباعة/المدرسة شهرياً:</label>
              <span class="calc-val-badge" id="printVal">1,500 ريال</span>
            </div>
            <input type="range" class="calc-slider" id="printRange" min="500" max="3500" value="1500" step="100" oninput="updateCalculations()">
            <div style="display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; margin-top: 4px;">
              <span>500 ريال</span>
              <span>1,500 ريال</span>
              <span>3,500 ريال</span>
            </div>
          </div>
        </div>

        <!-- Live Results Display -->
        <div class="calc-results-bar">
          <div class="calc-res-item">
            <span>وفر اشتراكات الـ LMS السنوي:</span>
            <strong id="resLms">1,925,000 ريال</strong>
            <small>بديلاً عن رسوم كلاسيرا وبلاك بورد</small>
          </div>

          <div class="calc-res-item">
            <span>وفر رسائل الـ SMS السنوي:</span>
            <strong id="resSms">210,000 ريال</strong>
            <small>بديلاً عن بوابات الرسائل النصية</small>
          </div>

          <div class="calc-res-item">
            <span>وفر الورق والمحابر والطباعة:</span>
            <strong id="resPrint">432,000 ريال</strong>
            <small>بفضل الحل التفاعلي الرقمي داخل البوابة</small>
          </div>

          <div class="calc-res-item" style="border-right: 2px solid #fde047; padding-right: 14px;">
            <span>إجمالي الوفر السنوي المتوقع:</span>
            <strong id="resTotal" style="font-size: 19pt; color: #fde047;">2,567,000 ريال</strong>
            <small>وفر سنوي مباشر في الميزانية التشغيلية</small>
          </div>

          <div class="calc-res-item">
            <span>الوفر التراكمي خلال 5 سنوات:</span>
            <strong id="resFiveYears" style="color: #6ee7b7;">12,835,000 ريال</strong>
            <small>صافي المبلغ المحفوظ في خزينة الشركة</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Detailed Financial Breakdown (The 5 Pillars of Real Savings) -->
    <div class="section-box">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-emerald">📊</div>
        <div>
          <h2>3. التشريح المالي الدقيق لبنود الوفر الحقيقي (Itemized Real Savings Breakdown)</h2>
          <p>بيان تفصيلي بالأرقام لركائز الوفر المالي الخمس التي تضمنتها المنظومة لشركة المدارس المتقدمة</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="styled-table">
          <thead>
            <tr>
              <th>بند الإنفاق والتشغيل</th>
              <th>الوضع القائم (الحلول المستأجرة)</th>
              <th>في منظومة المتقدمة المملوكة</th>
              <th>معادلة الاحتساب ومصدر الوفر</th>
              <th>صافي الوفر السنوي لـ 40 مدرسة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>1. تراخيص منصة التعلم الذكي (LMS)</strong></td>
              <td class="danger-cell">1,800,000 إلى 2,600,000 ريال سنوياً</td>
              <td class="success-cell">0.00 ريال (أصل رقمي حر مدى الحياة)</td>
              <td>إلغاء رسوم الـ 50-65 ريالاً لكل طالب واشتراكات المجمعات الخارجية بالكامل.</td>
              <td class="success-cell">+2,100,000 ريال / سنة</td>
            </tr>

            <tr>
              <td><strong>2. تكلفة الاستضافة وقواعد البيانات السحابية</strong></td>
              <td class="danger-cell">مدمجة ضمن التراخيص الباهظة للشركات</td>
              <td class="success-cell">12,000 إلى 22,000 ريال سنوياً فقط لكامل الشركة!</td>
              <td>استثمار حدود Google Cloud المجانية مع معمارية Edge Client-Side الخفيفة.</td>
              <td class="success-cell">تكلفة خوادم &lt; 40 ريالاً شهرياً لكل مدرسة!</td>
            </tr>

            <tr>
              <td><strong>3. بوابات الرسائل النصية القصيرة (SMS)</strong></td>
              <td class="danger-cell">190,000 إلى 280,000 ريال سنوياً</td>
              <td class="success-cell">0.00 ريال (إشعارات PWA + روابط سحابية مباشرة)</td>
              <td>إشعارات لحظية مجانية على هواتف أولياء الأمور وروابط واتساب فورية لبطاقات المربي.</td>
              <td class="success-cell">+220,000 ريال / سنة</td>
            </tr>

            <tr>
              <td><strong>4. الورق، المحابر، واستهلاك الطابعات</strong></td>
              <td class="danger-cell">600,000 إلى 950,000 ريال سنوياً</td>
              <td class="success-cell">خفض 70% من الاستهلاك الورقي للأعمال اليومية</td>
              <td>حل أوراق العمل التفاعلية بالكامل داخل البوابة وتصحيحها ورصدها آلياً.</td>
              <td class="success-cell">+480,000 ريال / سنة</td>
            </tr>

            <tr>
              <td><strong>5. أدوات الذكاء الاصطناعي وبنوك الاختبارات</strong></td>
              <td class="danger-cell">120,000 إلى 220,000 ريال سنوياً</td>
              <td class="success-cell">0.00 ريال (محركات تربوية مدمجة محلياً في الكود)</td>
              <td>توليد الخطط والأهداف وأوراق العمل الخماسية وخلاصات المربي بالذكاء الاصطناعي مدمج.</td>
              <td class="success-cell">+160,000 ريال / سنة</td>
            </tr>

            <tr>
              <td><strong>6. استشارات ومتابعة ملفات التميز والاعتماد (ETEC)</strong></td>
              <td class="danger-cell">250,000 إلى 400,000 ريال سنوياً</td>
              <td class="success-cell">0.00 ريال (ملف التميز جاهز ومؤتمت بـ 71 مؤشراً)</td>
              <td>مساحات شواهد جاهزة لكل مؤشر، وتوزيع مهام اللجان دون الحاجة لمكاتب استشارية.</td>
              <td class="success-cell">+280,000 ريال / سنة</td>
            </tr>

            <tr class="highlight-total">
              <td colspan="4"><strong style="font-size: 11pt; color: #064e3b;">🌟 إجمالي الوفر المالي التشغيلي السنوي الصافي لشركة المدارس المتقدمة:</strong></td>
              <td class="success-cell" style="font-size: 13pt;">+3,240,000 ريال سنوياً</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 4: 5-Year Cumulative Trajectory Visual Chart -->
    <div class="section-box">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-purple">📈</div>
        <div>
          <h2>4. المقارنة التراكمية التراجعية على مدار 5 سنوات (Total Cost of Ownership - TCO)</h2>
          <p>الفارق الشاسع بين الإنفاق المتصاعد على الحلول المؤجرة مقابل الإنفاق المستقر للمنظومة المملوكة</p>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-header">
          <div class="chart-title">📊 مقارنة المصروفات التراكمية (الحلول المستأجرة مقابل تملك المنظومة) بآلاف الريالات</div>
          <div class="chart-legend">
            <div class="legend-item">
              <div class="legend-box box-red"></div>
              <span>استئجار كلاسيرا ومزودي الـ SaaS (استنزاف متصاعد بلا أصل)</span>
            </div>
            <div class="legend-item">
              <div class="legend-box box-green"></div>
              <span>تشغيل منظومة المتقدمة (تكلفة خوادم تشغيلية فقط)</span>
            </div>
          </div>
        </div>

        <div class="bars-row">
          <!-- Year 1 -->
          <div class="bar-group">
            <div class="bar-label">السنة الأولى</div>
            <div class="bar-track">
              <div class="bar-fill-red" style="width: 28%;">2,650,000 ريال</div>
              <div class="bar-fill-green" style="width: 2%;">~18,000 ريال (خوادم سحابية فقط)</div>
            </div>
          </div>

          <!-- Year 2 -->
          <div class="bar-group">
            <div class="bar-label">السنة الثانية</div>
            <div class="bar-track">
              <div class="bar-fill-red" style="width: 54%;">5,300,000 ريال</div>
              <div class="bar-fill-green" style="width: 2.5%;">~38,000 ريال تراكمي</div>
            </div>
          </div>

          <!-- Year 3 -->
          <div class="bar-group">
            <div class="bar-label">السنة الثالثة</div>
            <div class="bar-track">
              <div class="bar-fill-red" style="width: 76%;">7,950,000 ريال</div>
              <div class="bar-fill-green" style="width: 3%;">~60,000 ريال تراكمي</div>
            </div>
          </div>

          <!-- Year 4 -->
          <div class="bar-group">
            <div class="bar-label">السنة الرابعة</div>
            <div class="bar-track">
              <div class="bar-fill-red" style="width: 88%;">10,600,000 ريال</div>
              <div class="bar-fill-green" style="width: 3.5%;">~84,000 ريال تراكمي</div>
            </div>
          </div>

          <!-- Year 5 -->
          <div class="bar-group">
            <div class="bar-label">السنة الخامسة</div>
            <div class="bar-track">
              <div class="bar-fill-red" style="width: 100%;">13,250,000 ريال (خسارة تامة بلا أصل)</div>
              <div class="bar-fill-green" style="width: 4%;">~110,000 ريال تراكمي (وفر يفوق 13.1 مليون!)</div>
            </div>
          </div>
        </div>

        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #334155; font-size: 8.8pt; color: #94a3b8; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <span>💡 <strong>النتيجة الاستثمارية:</strong> لا توجد أي رسوم شراء أو تراخيص؛ فالمنظومة نتاج ابتكار داخلي من كوادر الميدان توفر على الشركة أكثر من 13.1 مليون ريال نقداً خلال 5 سنوات!</span>
          <span style="color: #34d399; font-weight: 800;">انعدام تام للمخاطر المالية ورسوم البرمجيات المتكررة!</span>
        </div>
      </div>
    </div>

    <!-- Section 5: Strategic Capital Value & Commercial Opportunities -->
    <div class="section-box">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-gold">💎</div>
        <div>
          <h2>5. القيمة الرأسمالية المضافة والتحول إلى "مركز أرباح استثماري" (Commercial EdTech Potential)</h2>
          <p>كيف تحول المنظومة قطاع تقنية المعلومات بالشركة من مستهلك للميزانية إلى رافد إيرادات مليونية</p>
        </div>
      </div>

      <p style="font-size: 10pt; color: #334155; margin-bottom: 16px;">
        إن امتلاك شركة المدارس المتقدمة للشيفرة المصدرية (Source Code) وحقوق الملكية الفكرية بنسبة 100% يفتح أمام سعادة رئيس مجلس الإدارة آفاقاً استثمارية وتسويقية تتجاوز حدود الوفر الداخلي:
      </p>

      <div class="pillars-grid">
        <div class="pillar-card border-gold">
          <h4>🏰 1. أصل رأسمالي مسجل بالقوائم المالية</h4>
          <p>تسجيل المنظومة كـ "أصل غير ملموس" (Intangible Digital Asset) بقيمة سوقية تعزز الملاءة الائتمانية والتقييم المؤسسي لشركة المدارس المتقدمة في حال الإدراج في السوق المالية (تداول) أو استقطاب شركاء استراتيجيين.</p>
        </div>

        <div class="pillar-card border-emerald">
          <h4>🚀 2. ترخيص المنظومة تجارياً لشبكات تعليمية أخرى</h4>
          <p>تمتلك المنظومة معمارية سحابية متعددة المدارس (Multi-Tenancy) جاهزة لعزل المدارس بكفاءة. تستطيع شركة المتقدمة ترخيص المنظومة كمنتج EdTech سعودي منافس لمدارس أهلية وعالمية أخرى بالمملكة، وتوليد <strong>إيرادات سنوية تتجاوز ملايين الريالات</strong>.</p>
        </div>

        <div class="pillar-card border-blue">
          <h4>🛡️ 3. استقلالية تامة وحصانة ضد التضخم البرمجي</h4>
          <p>الحماية الكاملة ضد أي زيادة مفاجئة قد تفرضها شركات الـ SaaS مستقبلاً (كما حدث مع منصات متعددة رفعت رسومها بنسبة 30% إلى 50% بعد تكريس اعتماد المدارس عليها).</p>
        </div>

        <div class="pillar-card border-purple">
          <h4>⚡ 4. التخصيص الفوري وفق متطلبات الإدارة والوزارة</h4>
          <p>أي لائحة وزارية تصدر من وزارة التعليم أو هيئة تقويم التعليم (مثل اختبارات نافس، أو مهارات التحصيلي، أو مسارات الدبلومة) يمكن برمجتها وتعميمها على الـ 40 مدرسة في غضون 24 ساعة دون دفع فواتير طلبات التغيير الباهظة.</p>
        </div>
      </div>
    </div>

    <!-- Section 6: Institutional Handover & Operational Readiness (NO DEVELOPER FINANCIAL CLAIMS) -->
    <div class="section-box">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-emerald">🤝</div>
        <div>
          <h2>6. الرؤية التشغيلية والجاهزية التامة لتسليم وتوطين المنظومة تحت إشراف سعادة رئيس مجلس الإدارة</h2>
          <p>خطة التمكين المؤسسي، نقل المعرفة التقنية، واستدامة التشغيل لكامل شبكة المدارس</p>
        </div>
      </div>

      <p style="font-size: 10pt; color: #334155; margin-bottom: 16px;">
        انطلاقاً من روح الانتماء والولاء لهذا الصرح التعليمي العريق (معلم بمجمع المدارس المتقدمة للتعلم الذكي بجدة)، ورغبة في وضع هذا الإنجاز التقني والتربوي بالكامل تحت تصرف وتوجيه سعادة الدكتور عبدالرحمن الحقباني، تتجسد الجاهزية المؤسسية في ثلاثة محاور تشغيلية متكاملة:
      </p>

      <div class="readiness-grid">

        <!-- Pillar 1: Source Code & Sovereign IP Handover -->
        <div class="readiness-card card-sovereignty">
          <div>
            <div class="readiness-icon-box icon-box-emerald">🏛️</div>
            <div class="readiness-title">المحور الأول: نقل وتسليم الشيفرة المصدرية (Source Code) والملكية الفكرية 100% للشركة</div>
            <div class="readiness-sub">Full Intellectual Property Transfer & Sovereign Code Ownership</div>

            <ul class="readiness-list">
              <li>تسليم كافة الأكواد المصدرية (Full Source Code) وقواعد البيانات لتسجيلها رسمياً باسم «شركة المدارس المتقدمة التعليمية».</li>
              <li>استخدام أبدي ومجاني وغير مشروط لكافة مجمعات ومدارس الشركة الحالية والمستقبلية (40+ مدرسة).</li>
              <li>السيادة المطلقة للشركة على بيانات الطلاب والمعلمين وفق نظام حماية البيانات الشخصية السعودي (PDPL).</li>
              <li>حرية التعديل والإضافة والتطوير التام دون الحاجة لأي إذن من أطراف خارجية.</li>
            </ul>
          </div>
          <div class="readiness-footer-badge" style="background: #ecfdf5; color: #065f46;">
            🛡️ بناء أصل رقمي سيادي دائم لشركة المدارس المتقدمة يوقف الارتهان للشركات الخارجية للأبد.
          </div>
        </div>

        <!-- Pillar 2: Knowledge Transfer & IT Enablement -->
        <div class="readiness-card card-training">
          <div>
            <div class="readiness-icon-box icon-box-blue">💻</div>
            <div class="readiness-title">المحور الثاني: التدريب المؤسسي ونقل المعرفة لفريق الدعم وتقنية المعلومات بالشركة</div>
            <div class="readiness-sub">Enterprise Knowledge Transfer & In-House IT Enablement</div>

            <ul class="readiness-list">
              <li>تدريب الكادر التقني وفرق الدعم الفني بالشركة على إدارة الخوادم وقواعد البيانات السحابية بامتياز.</li>
              <li>تقديم حقيبة توثيق برمجية كاملة (Technical Documentation & API Specs) لكافة البوابات السبع.</li>
              <li>تنظيم ورش عمل تفاعلية سريعة (20 دقيقة) لمنسقي التحول الرقمي ومدراء المدارس في المجمعات.</li>
              <li>إرساء آليات النسخ الاحتياطي الآلي اليومي واستعادة البيانات اللحظية (Point-in-Time Recovery).</li>
            </ul>
          </div>
          <div class="readiness-footer-badge" style="background: #eff6ff; color: #1e40af;">
            ⚡ تمكين ذاتي كامل لكوادر الشركة التقنية لإدارة المنظومة باستقلالية واقتدار.
          </div>
        </div>

        <!-- Pillar 3: Continuous Support & Devoted Field Follow-up -->
        <div class="readiness-card card-support">
          <div>
            <div class="readiness-icon-box icon-box-purple">🌟</div>
            <div class="readiness-title">المحور الثالث: الالتزام الميداني بالدعم الفني والتطوير المستمر وفاءً للصرح</div>
            <div class="readiness-sub">Continuous Field Support & Dedication to Excellence</div>

            <ul class="readiness-list">
              <li>الجاهزية التامة والتطوع الكامل للمتابعة الميدانية وتقديم الاستشارات التقنية لضمان نجاح التدشين.</li>
              <li>مواكبة وتحديث متطلبات المناهج والاختبارات الوزارية (نافس، القدرات، والتحصيلي) فورياً.</li>
              <li>التطوير المستمر لأدوات الذكاء الاصطناعي وبطاقة «المربي المخلص» تلبيةً لرؤية سعادة رئيس مجلس الإدارة.</li>
              <li>العمل بروح الفريق الواحد مع كافة قيادات المجمعات لترسيخ ريادة المدارس المتقدمة وطنياً وإقليمياً.</li>
            </ul>
          </div>
          <div class="readiness-footer-badge" style="background: #faf5ff; color: #6b21a8;">
            🤝 خدمة مستمرة ومخلصة نابعة من كوادر الميدان التعليمي لتعزيز مكانة هذا الصرح العريق.
          </div>
        </div>

      </div>
    </div>

    <!-- Section 7: Fast-Track Rollout Roadmap (60 Days) -->
    <div class="section-box">
      <div class="section-title-wrap">
        <div class="section-icon-badge icon-blue">🚀</div>
        <div>
          <h2>7. خطة التدشين والتعميم السريع على الـ 40+ مدرسة خلال 60 يوماً (Fast-Track Rollout)</h2>
          <p>خارطة طريق مدروسة ومحكمة تضمن النقلة الرقمية السلسة دون أي ارتباك تشغيلي</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 14px;">
        <div style="background: #f8fafc; border-right: 4px solid #1d4ed8; border-radius: 10px; padding: 18px;">
          <span style="font-size: 8.5pt; font-weight: 800; color: #1d4ed8; display: block; margin-bottom: 4px;">المرحلة 1 • الأسبوع 1 - 2</span>
          <strong style="font-size: 10.5pt; color: #0f172a; display: block; margin-bottom: 6px;">التهيئة المؤسسية والتوطين</strong>
          <p style="font-size: 9pt; color: #64748b; line-height: 1.55;">
            ربط النطاق الرسمي للشركة (Domain: smart.motaqadimah.edu.sa)، وضبط الهوية والشعارات، وتهيئة قواعد البيانات السحابية المستقلة لكل مدرسة مع عزل الـ schoolId.
          </p>
        </div>

        <div style="background: #f8fafc; border-right: 4px solid #0284c7; border-radius: 10px; padding: 18px;">
          <span style="font-size: 8.5pt; font-weight: 800; color: #0284c7; display: block; margin-bottom: 4px;">المرحلة 2 • الأسبوع 3 - 4</span>
          <strong style="font-size: 10.5pt; color: #0f172a; display: block; margin-bottom: 6px;">التشغيل التجريبي والتدريب القيادي</strong>
          <p style="font-size: 9pt; color: #64748b; line-height: 1.55;">
            إطلاق المنظومة على 3 مجمعات كبرى نموذجية (بنين، بنات، دبلومة أمريكية)، وتدريب مدراء المدارس والمشرفين عبر ورش عمل تدريبية مركزة (20 دقيقة لكل قائد).
          </p>
        </div>

        <div style="background: #f8fafc; border-right: 4px solid #d97706; border-radius: 10px; padding: 18px;">
          <span style="font-size: 8.5pt; font-weight: 800; color: #d97706; display: block; margin-bottom: 4px;">المرحلة 3 • الأسبوع 5 - 6</span>
          <strong style="font-size: 10.5pt; color: #0f172a; display: block; margin-bottom: 6px;">استيراد البيانات وتعميم المدارس</strong>
          <p style="font-size: 9pt; color: #64748b; line-height: 1.55;">
            استيراد قوائم المعلمين والطلاب من نظام نور بنقرة زر واحدة عبر محرك الترحيل الآلي، وتوزيع الصلاحيات وتفعيل بوابات المعلمين وجداول الحصص.
          </p>
        </div>

        <div style="background: #ecfdf5; border-right: 4px solid #10b981; border-radius: 10px; padding: 18px;">
          <span style="font-size: 8.5pt; font-weight: 800; color: #059669; display: block; margin-bottom: 4px;">المرحلة 4 • الأسبوع 7 - 8</span>
          <strong style="font-size: 10.5pt; color: #065f46; display: block; margin-bottom: 6px;">التدشين الكامل واللوحة الرئاسية</strong>
          <p style="font-size: 9pt; color: #047857; line-height: 1.55;">
            إطلاق تطبيق PWA لأولياء الأمور والطلاب في الـ 40 مدرسة، وتفعيل لوحة المتابعة اللحظية ومصفوفة الامتثال في مكتب سعادة رئيس مجلس الإدارة.
          </p>
        </div>
      </div>
    </div>

    <!-- Executive Sign-off and Contact Information (Respectful & Service-Oriented) -->
    <div class="signature-card">
      <div class="sig-person-group">
        <div class="sig-avatar">👨‍💻</div>
        <div class="sig-details">
          <span class="role-title">إعداد وتصميم وتطوير وهندسة المنظومة:</span>
          <strong class="author-name">أ. محمد عبدالله جمعة</strong>
          <p class="author-desc">
            معلم رياضيات ومطور برمجيات وأنظمة التعلم الذكي • مجمع المدارس المتقدمة للتعلم الذكي بجدة
          </p>
          <div class="sig-endorsement-pill">
            <span>متابعة ودعم وإشراف:</span> <strong>أ / جمال علي محمد</strong> • <strong>د / علي الزهراني</strong>
          </div>
        </div>
      </div>

      <div class="sig-contact-block">
        <div class="phone-label">للتواصل والمتابعة الميدانية المباشرة:</div>
        <div class="phone-num">
          <span>📞</span>
          <span>0545841974</span>
        </div>
        <div class="demo-ready-badge">
          ✨ في خدمة شركة المدارس المتقدمة ومستعد لتقديم عرض تجريبي حي (Live Demo) أمام سعادتكم
        </div>
      </div>
    </div>

    <!-- Institutional Footer Stamp -->
    <div style="text-align: center; margin-top: 26px; font-size: 9pt; color: #64748b; padding-bottom: 16px;">
      وثيقة دراسة الجدوى المالية والوفر الاستثماري المتوقع • موجهة لسعادة رئيس مجلس الإدارة الدكتور عبدالرحمن بن سعد الحقباني<br>
      شركة المدارس المتقدمة التعليمية 1447 / 1448 هـ • حفظ حقوق الملكية والابتكار المؤسسي ✔
    </div>

  </div>

  <!-- Interactive Calculator JavaScript Engine -->
  <script>
    function updateCalculations() {
      // Inputs
      const schools = parseInt(document.getElementById('schoolsRange').value);
      const students = parseInt(document.getElementById('studentsRange').value);
      const lmsFee = parseInt(document.getElementById('lmsFeeRange').value);
      const printMonthly = parseInt(document.getElementById('printRange').value);

      // Display Labels
      document.getElementById('schoolsVal').innerText = schools + ' مدرسة';
      document.getElementById('studentsVal').innerText = students.toLocaleString('ar-SA') + ' طالب';
      document.getElementById('lmsFeeVal').innerText = lmsFee + ' ريال';
      document.getElementById('printVal').innerText = printMonthly.toLocaleString('ar-SA') + ' ريال';

      // Computations
      // 1. LMS Savings: Students * Fee (minus negligible hosting of ~400 SAR per school)
      const lmsAnnualCost = students * lmsFee;
      const ourHosting = schools * 400; // ~400 SAR per school per year
      const netLmsSavings = Math.max(0, lmsAnnualCost - ourHosting);

      // 2. SMS Savings: ~60 SMS per student per year at 0.10 SAR per SMS
      const smsSavings = students * 60 * 0.10;

      // 3. Printing Savings: PrintMonthly * 10 academic months * schools * 70% digital saving
      const printSavings = (printMonthly * 10 * schools) * 0.70;

      // Total Annual Savings
      const totalAnnualSavings = netLmsSavings + smsSavings + printSavings;
      const fiveYearSavings = totalAnnualSavings * 5;

      // Update UI with Formatted Currency
      document.getElementById('resLms').innerText = Math.round(netLmsSavings).toLocaleString('ar-SA') + ' ريال';
      document.getElementById('resSms').innerText = Math.round(smsSavings).toLocaleString('ar-SA') + ' ريال';
      document.getElementById('resPrint').innerText = Math.round(printSavings).toLocaleString('ar-SA') + ' ريال';
      document.getElementById('resTotal').innerText = Math.round(totalAnnualSavings).toLocaleString('ar-SA') + ' ريال';
      document.getElementById('resFiveYears').innerText = Math.round(fiveYearSavings).toLocaleString('ar-SA') + ' ريال';
    }

    // Run on load
    window.addEventListener('DOMContentLoaded', updateCalculations);
  </script>

</body>
</html>
`;

const outputPath = path.join(process.cwd(), 'تقرير_الجدوى_المالية_والوفر_المتوقع_للدكتور_عبدالرحمن_الحقباني.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');

const englishOutputPath = path.join(process.cwd(), 'executive_financial_feasibility_and_real_savings_report.html');
fs.writeFileSync(englishOutputPath, htmlContent, 'utf8');

console.log('Reports successfully updated without developer financial claims.');
