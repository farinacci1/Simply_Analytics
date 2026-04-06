import React, { useState } from 'react';
import {
  FiDatabase,
  FiGrid,
  FiLayers,
  FiZap,
  FiBarChart2,
  FiPieChart,
  FiTrendingUp,
  FiFilter,
  FiShare2,
  FiArrowRight,
  FiPlay,
  FiCode,
  FiLock,
  FiCpu,
  FiMessageCircle,
  FiChevronDown,
  FiMousePointer,
  FiLayout,
  FiTarget,
  FiGitBranch,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import SimplyLogo from '../assets/Simply_Logo.png';
import '../styles/GettingStarted.css';

const GettingStarted = React.memo(({ onSignIn }) => {
  const [activeCapability, setActiveCapability] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);

  const scrollToCapabilities = () => {
    document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' });
  };

  const capabilities = [
    {
      id: 'semantic',
      icon: FiLayers,
      title: 'Semantic-First Analytics',
      description: 'Build on top of Snowflake Semantic Views for governed, reusable data definitions. Consistent metrics across every dashboard — no more conflicting numbers.',
      highlights: ['Governed metrics', 'Reusable definitions', 'Single source of truth'],
    },
    {
      id: 'builder',
      icon: FiMousePointer,
      title: 'Drag & Drop Builder',
      description: 'Create stunning visualizations by simply dragging fields onto shelves. No SQL required — just point, click, and explore your data visually.',
      highlights: ['20+ chart types', 'Real-time preview', 'Intuitive shelves'],
    },
    {
      id: 'ai',
      icon: HiSparkles,
      title: 'Cortex AI Integration',
      description: 'Enhance your data with AI-powered calculated fields using Snowflake Cortex. Analyze sentiment, summarize text, translate content, and more.',
      highlights: ['AI calculated fields', 'Natural language queries', 'Smart suggestions'],
    },
    {
      id: 'secure',
      icon: FiLock,
      title: 'Enterprise Security',
      description: 'SAML SSO, SCIM provisioning, two-factor authentication with TOTP and passkeys, role-based access control, and session management built in.',
      highlights: ['SAML & SCIM', 'MFA with passkeys', 'Role-based access'],
    },
  ];

  const features = [
    {
      icon: FiDatabase,
      title: 'Snowflake Native',
      description: 'Direct connection to your Snowflake warehouse with PAT tokens or key-pair authentication. Your data never leaves Snowflake.',
      color: '#00d4ff',
    },
    {
      icon: FiLayout,
      title: 'Interactive Dashboards',
      description: 'Resizable, draggable widget grids with cross-filtering. Build dashboards that tell a story.',
      color: '#10b981',
    },
    {
      icon: FiMessageCircle,
      title: 'AskAI',
      description: 'Query your data in natural language. Get instant answers, visualizations, and insights without writing SQL.',
      color: '#a855f7',
    },
    {
      icon: FiCpu,
      title: 'AI Copilot',
      description: 'Dashboard AI copilot that helps you explore data, suggest visualizations, and build calculated fields.',
      color: '#f59e0b',
    },
    {
      icon: FiTarget,
      title: 'Advanced Visualizations',
      description: 'From Sankey diagrams to box plots, heatmaps to geographic maps — 20+ chart types at your fingertips.',
      color: '#ef4444',
    },
    {
      icon: FiGitBranch,
      title: 'Open Source',
      description: 'Fully open-source and self-hosted. Deploy with Docker in minutes. Own your analytics stack completely.',
      color: '#06b6d4',
    },
  ];

  const chartTypes = [
    { icon: FiBarChart2, name: 'Bar Charts' },
    { icon: FiPieChart, name: 'Pie & Donut' },
    { icon: FiTrendingUp, name: 'Line & Area' },
    { icon: FiGrid, name: 'Tables & Pivots' },
    { icon: FiShare2, name: 'Sankey Flows' },
    { icon: FiFilter, name: 'Histograms' },
  ];

  const steps = [
    {
      number: '01',
      title: 'Connect',
      description: 'Link your Snowflake warehouse in seconds with secure authentication',
      icon: FiDatabase,
    },
    {
      number: '02',
      title: 'Model',
      description: 'Select from your Snowflake Semantic Views for governed data access',
      icon: FiLayers,
    },
    {
      number: '03',
      title: 'Build',
      description: 'Drag fields onto shelves to create powerful interactive visualizations',
      icon: FiGrid,
    },
    {
      number: '04',
      title: 'Share',
      description: 'Publish dashboards and collaborate across your organization',
      icon: FiShare2,
    },
  ];

  const faqs = [
    {
      question: 'Do I need to know SQL to use Simply Analytics?',
      answer: 'No. Simply Analytics translates your drag-and-drop actions into optimized SQL automatically. You can also use AskAI to query your data in plain English. For power users, AI-powered calculated fields let you tap into Snowflake Cortex without writing complex queries.',
    },
    {
      question: 'How does Simply Analytics connect to my data?',
      answer: 'Simply Analytics connects directly to your Snowflake data warehouse using PAT tokens or key-pair authentication. Your data never leaves Snowflake — queries are executed in your warehouse and only results are displayed in the browser.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Absolutely. Simply Analytics supports SAML SSO, SCIM user provisioning, two-factor authentication (TOTP and passkeys), role-based access control, and session management. All connections to Snowflake are encrypted, and credentials are stored using AES-256 encryption.',
    },
    {
      question: 'Can I self-host Simply Analytics?',
      answer: 'Yes. Simply Analytics is fully open-source and designed for self-hosting. Deploy with Docker Compose in minutes using PostgreSQL for metadata and your own Snowflake warehouse for data. You have complete control over your analytics stack.',
    },
    {
      question: 'What chart types are supported?',
      answer: 'Simply Analytics supports 20+ chart types including bar, line, area, pie, donut, scatter, bubble, heatmap, treemap, Sankey diagrams, box plots, histograms, geographic maps, pivot tables, KPI cards, and more.',
    },
  ];

  return (
    <div className="getting-started">
      {/* Top Nav */}
      <header className="gs-topnav">
        <div className="gs-topnav-inner">
          <div className="gs-topnav-brand">
            <img src={SimplyLogo} alt="Simply" className="gs-topnav-logo" />
            <span className="gs-topnav-name">Simply Analytics</span>
          </div>
          <nav className="gs-topnav-links">
            <button onClick={scrollToCapabilities}>Features</button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}>FAQ</button>
          </nav>
          <button className="gs-topnav-cta" onClick={onSignIn}>
            Sign In
          </button>
        </div>
      </header>

      {/* Floating background elements */}
      <div className="gs-bg-orbs">
        <div className="gs-orb gs-orb-1" />
        <div className="gs-orb gs-orb-2" />
        <div className="gs-orb gs-orb-3" />
      </div>

      {/* Hero Section */}
      <section className="gs-hero">
        <div className="gs-hero-inner">
          <div className="gs-hero-content">
            <div className="gs-hero-badge">
              <HiSparkles /> Built for Snowflake
            </div>
            <h1 className="gs-title">
              <span className="gs-title-line">The Analytics Platform</span>
              <span className="gs-title-gradient">Built for Your Data</span>
            </h1>
            <p className="gs-subtitle">
              Create beautiful, interactive dashboards powered by Snowflake Semantic Views 
              and Cortex AI. Drag-and-drop simplicity meets enterprise-grade analytics.
            </p>
            <div className="gs-hero-actions">
              <button className="gs-primary-btn" onClick={onSignIn}>
                <FiPlay /> Get Started
              </button>
              <button className="gs-secondary-btn" onClick={scrollToCapabilities}>
                Learn More <FiArrowRight />
              </button>
            </div>
            <div className="gs-hero-stats">
              <div className="gs-stat">
                <span className="gs-stat-value">20+</span>
                <span className="gs-stat-label">Chart Types</span>
              </div>
              <div className="gs-stat-divider" />
              <div className="gs-stat">
                <span className="gs-stat-value">AI</span>
                <span className="gs-stat-label">Cortex Powered</span>
              </div>
              <div className="gs-stat-divider" />
              <div className="gs-stat">
                <span className="gs-stat-value">OSS</span>
                <span className="gs-stat-label">Open Source</span>
              </div>
            </div>
          </div>
          <div className="gs-hero-visual">
            <div className="gs-dashboard-preview">
              <div className="gs-preview-toolbar">
                <div className="gs-preview-dots">
                  <span className="gs-dot red" />
                  <span className="gs-dot yellow" />
                  <span className="gs-dot green" />
                </div>
                <span className="gs-preview-title">Sales Analytics Dashboard</span>
              </div>
              <div className="gs-preview-body">
                <div className="gs-preview-sidebar">
                  <div className="gs-preview-nav-item active" />
                  <div className="gs-preview-nav-item" />
                  <div className="gs-preview-nav-item" />
                </div>
                <div className="gs-preview-content">
                  <div className="gs-preview-row">
                    <div className="gs-preview-kpi">
                      <div className="gs-kpi-label" />
                      <div className="gs-kpi-value">$2.4M</div>
                      <div className="gs-kpi-trend up">+12.5%</div>
                    </div>
                    <div className="gs-preview-kpi">
                      <div className="gs-kpi-label" />
                      <div className="gs-kpi-value">1,847</div>
                      <div className="gs-kpi-trend up">+8.3%</div>
                    </div>
                    <div className="gs-preview-kpi">
                      <div className="gs-kpi-label" />
                      <div className="gs-kpi-value">94.2%</div>
                      <div className="gs-kpi-trend neutral">+0.5%</div>
                    </div>
                  </div>
                  <div className="gs-preview-row">
                    <div className="gs-preview-chart main">
                      <div className="gs-mini-bars">
                        <div className="gs-mini-bar" style={{ height: '45%' }} />
                        <div className="gs-mini-bar" style={{ height: '65%' }} />
                        <div className="gs-mini-bar" style={{ height: '55%' }} />
                        <div className="gs-mini-bar" style={{ height: '80%' }} />
                        <div className="gs-mini-bar" style={{ height: '70%' }} />
                        <div className="gs-mini-bar" style={{ height: '90%' }} />
                        <div className="gs-mini-bar" style={{ height: '60%' }} />
                        <div className="gs-mini-bar" style={{ height: '75%' }} />
                      </div>
                    </div>
                    <div className="gs-preview-chart side">
                      <div className="gs-mini-donut">
                        <svg viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(14,165,233,0.15)" strokeWidth="4" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#0ea5e9" strokeWidth="4"
                            strokeDasharray="55 45" strokeDashoffset="25" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#a855f7" strokeWidth="4"
                            strokeDasharray="25 75" strokeDashoffset="70" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4"
                            strokeDasharray="20 80" strokeDashoffset="45" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="gs-preview-glow" />
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="gs-section gs-capabilities">
        <div className="gs-section-header">
          <div className="gs-section-badge">Capabilities</div>
          <h2 className="gs-section-title">Everything You Need to<br /><span className="gs-gradient-text">Unlock Your Data</span></h2>
          <p className="gs-section-subtitle">
            From semantic modeling to AI-powered insights — a complete analytics platform
          </p>
        </div>
        <div className="gs-capabilities-layout">
          <div className="gs-capabilities-tabs">
            {capabilities.map((cap, idx) => (
              <button
                key={cap.id}
                className={`gs-cap-tab ${activeCapability === idx ? 'active' : ''}`}
                onClick={() => setActiveCapability(idx)}
              >
                <cap.icon className="gs-cap-tab-icon" />
                <span>{cap.title}</span>
                <FiArrowRight className="gs-cap-tab-arrow" />
              </button>
            ))}
          </div>
          <div className="gs-capabilities-detail">
            <div className="gs-cap-detail-content" key={activeCapability}>
              <h3>{capabilities[activeCapability].title}</h3>
              <p>{capabilities[activeCapability].description}</p>
              <div className="gs-cap-highlights">
                {capabilities[activeCapability].highlights.map((h, i) => (
                  <div key={i} className="gs-cap-highlight">
                    <FiZap />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="gs-section gs-features-section">
        <div className="gs-section-header">
          <div className="gs-section-badge">Features</div>
          <h2 className="gs-section-title">Why Teams Choose<br /><span className="gs-gradient-text">Simply Analytics</span></h2>
        </div>
        <div className="gs-features-grid">
          {features.map((feature, idx) => (
            <div key={idx} className="gs-feature-card">
              <div className="gs-feature-icon" style={{ background: `${feature.color}15`, color: feature.color }}>
                <feature.icon />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Chart Types */}
      <section className="gs-section gs-charts-section">
        <div className="gs-section-header">
          <h2 className="gs-section-title">20+ Visualization Types</h2>
          <p className="gs-section-subtitle">
            From simple bar charts to complex Sankey diagrams, box plots, and geographic maps
          </p>
        </div>
        <div className="gs-chart-types">
          {chartTypes.map((chart, idx) => (
            <div key={idx} className="gs-chart-type">
              <chart.icon />
              <span>{chart.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* AI Section */}
      <section className="gs-section gs-ai-section">
        <div className="gs-ai-inner">
          <div className="gs-ai-content">
            <div className="gs-section-badge purple">
              <HiSparkles /> Snowflake Cortex AI
            </div>
            <h2>AI That Understands<br /><span className="gs-gradient-text-purple">Your Data</span></h2>
            <p>
              Create calculated fields using Snowflake Cortex AI functions. 
              Analyze sentiment, summarize text, translate content, and query your data 
              in natural language — all without leaving your dashboard.
            </p>
            <div className="gs-ai-functions">
              {['SENTIMENT', 'SUMMARIZE', 'TRANSLATE', 'COMPLETE'].map((fn) => (
                <div key={fn} className="gs-ai-func">
                  <FiCode />
                  <span>{fn}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="gs-ai-visual">
            <div className="gs-code-preview">
              <div className="gs-code-header">
                <div className="gs-code-dots">
                  <span className="gs-dot red" />
                  <span className="gs-dot yellow" />
                  <span className="gs-dot green" />
                </div>
                <span className="gs-code-title">calculated_field.sql</span>
              </div>
              <pre className="gs-code-content">
{`-- AI-powered sentiment analysis
SNOWFLAKE.CORTEX.SENTIMENT(
  "CUSTOMER_REVIEW"
) AS REVIEW_SENTIMENT

-- Natural language summarization
SNOWFLAKE.CORTEX.SUMMARIZE(
  "SUPPORT_TICKET_TEXT"
) AS TICKET_SUMMARY`}
              </pre>
            </div>
            <div className="gs-code-glow" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="gs-section gs-steps-section">
        <div className="gs-section-header">
          <div className="gs-section-badge">Getting Started</div>
          <h2 className="gs-section-title">Up and Running in<br /><span className="gs-gradient-text">Four Simple Steps</span></h2>
        </div>
        <div className="gs-steps">
          {steps.map((step, idx) => (
            <div key={idx} className="gs-step">
              <div className="gs-step-number">{step.number}</div>
              <div className="gs-step-icon">
                <step.icon />
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {idx < steps.length - 1 && (
                <div className="gs-step-connector">
                  <FiArrowRight />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="gs-section gs-faq-section">
        <div className="gs-section-header">
          <h2 className="gs-section-title">Frequently Asked Questions</h2>
          <p className="gs-section-subtitle">
            Everything you need to know about Simply Analytics
          </p>
        </div>
        <div className="gs-faq-list">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`gs-faq-item ${openFaq === idx ? 'open' : ''}`}
            >
              <button
                className="gs-faq-question"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{faq.question}</span>
                <FiChevronDown className="gs-faq-chevron" />
              </button>
              <div className="gs-faq-answer">
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="gs-cta-section">
        <div className="gs-cta-inner">
          <div className="gs-cta-content">
            <h2>Ready to Transform<br />Your Analytics?</h2>
            <p>Deploy in minutes with Docker. Connect your Snowflake warehouse and start building dashboards today.</p>
            <div className="gs-cta-actions">
              <button className="gs-cta-btn" onClick={onSignIn}>
                <FiZap /> Get Started Now
              </button>
            </div>
          </div>
          <div className="gs-cta-orb" />
        </div>
      </section>

      {/* Footer */}
      <footer className="gs-footer">
        <div className="gs-footer-inner">
          <div className="gs-footer-brand">
            <div className="gs-footer-logo">
              <img src={SimplyLogo} alt="Simply" />
              <span>Simply Analytics</span>
            </div>
            <p>Open-source analytics platform built for Snowflake.</p>
          </div>
          <div className="gs-footer-links">
            <div className="gs-footer-col">
              <h4>Product</h4>
              <span>Dashboards</span>
              <span>AskAI</span>
              <span>Visualizations</span>
              <span>AI Copilot</span>
            </div>
            <div className="gs-footer-col">
              <h4>Platform</h4>
              <span>Snowflake</span>
              <span>Semantic Views</span>
              <span>Cortex AI</span>
              <span>Security</span>
            </div>
            <div className="gs-footer-col">
              <h4>Resources</h4>
              <span>Documentation</span>
              <span>GitHub</span>
              <span>Docker Hub</span>
            </div>
          </div>
        </div>
        <div className="gs-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Simply Analytics. Open Source under MIT License.</span>
        </div>
      </footer>
    </div>
  );
});

export default GettingStarted;
