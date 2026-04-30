# 🌌 Horizon: Privacy-First Prediction Markets on Stellar

Horizon is a next-generation prediction market platform built on the Stellar blockchain, leveraging Soroban smart contracts and Zero-Knowledge (ZK) proofs to ensure trader privacy while providing high-fidelity market intelligence.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://horizonmarkets.vercel.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-black?style=for-the-badge&logo=github)](https://github.com/Subho4531/eventhorizon)
[![Feedback](https://img.shields.io/badge/Feedback-Submit-orange?style=for-the-badge&logo=googleforms)](https://forms.gle/2gkJTvdxtBmSaDmU8)
![Stellar](https://img.shields.io/badge/Stellar-Soroban-blueviolet?style=for-the-badge&logo=stellar)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)

---

## 📑 Table of Contents

- [📖 Project Description](#-project-description)
- [🎥 Video Demo](#-video-demo)
- [✨ Key Features](#-key-features)
- [🥋 Level 6: Black Belt - Agentic Evolution](#-level-6-black-belt---agentic-evolution)
- [🏗️ Architecture](#️-architecture)
- [📜 Smartcontract Details](#-smartcontract-details)
- [🌟 Project Vision](#-project-vision)
- [🚀 Future Scope](#-future-scope)
- [🖼️ UI Screenshots](#️-ui-screenshots)
- [📝 User Onboarding & Feedback](#-user-onboarding--feedback)
- [🎖️ Level 6 Requirements Checklist](#️-level-6-requirements-checklist)
- [🚀 Getting Started](#-getting-started)
- [🛠️ Tech Stack](#️-tech-stack)
- [📂 Project Structure](#-project-structure)

---

## 📖 Project Description

Horizon redefines prediction markets by prioritizing user privacy and data integrity. By integrating **Zero-Knowledge Proofs (ZKPs)** on the **Stellar Network**, Horizon allows users to take positions on global events without revealing their specific bets until the market is resolved. This prevents front-running and manipulation, creating a fairer ecosystem for all participants.

---

## 🎥 Video Demo

Experience Horizon in action:

[![Horizon Video Demo](https://img.youtube.com/vi/zxn6RVdhBBU/0.jpg)](https://youtu.be/zxn6RVdhBBU)

*Watch the full walkthrough of the Privacy-First Prediction Market on Stellar.*

---

## ✨ Key Features

- **🔐 Privacy via ZK Proofs**: All bets are placed as ZK commitments. Positions remain private until the "Reveal" phase.
- **⚡ Stellar/Soroban Integration**: High-speed, low-cost settlement using Stellar's latest smart contract engine.
- **📊 Intelligence Dashboard**: Real-time analysis of market quality, risk scores, and sentiment trends.
- **🛡️ Secure Escrow**: Non-custodial escrow contracts manage user funds with cryptographic certainty.
- **🔍 Manipulation Detection**: Automated systems flag suspicious trading patterns to ensure market health.
- **🤖 Agentic Market Discovery**: Autonomous AI agents identify trends and resolve markets using real-world data feeds.

---

## 🥋 Level 6: Black Belt - Agentic Evolution

Horizon has evolved into a production-grade **Agentic Market Intelligence System**. This transition introduces autonomous lifecycle management for markets, driven by specialized AI agents and distributed background workers.

### 🤖 Autonomous Agentic Pipeline
Horizon features a sophisticated multi-agent pipeline that transforms raw global data into executable on-chain markets with zero manual intervention.

- **🔍 Deep Semantic Research**: Agents utilize **SerpAPI** and **Gemini 3 Flash** to ingest real-time news, identifying emerging trends and assigning "Intelligence Scores" to potential market topics.
- **🏗️ Agent Framework**: A hybrid **Python-Node.js** architecture designed for seamless AI integration and high-performance worker coordination.
- **✅ Self-Validating Resolutions**: The system autonomously cross-references high-authority sources to verify event outcomes before triggering the Soroban smart contract for resolution.

### ⚡ High-Performance Redis Pipeline
The backbone of Horizon's reliability is a distributed, Redis-driven orchestration layer that ensures the platform remains responsive under extreme loads.

- **🎯 Distributed Job Orchestration**: Leverages **BullMQ** on **Upstash Redis** to decouple heavy AI computation from the main API thread, maintaining a 99.9% uptime for the user terminal.
- **📡 Global State Relay**: Real-time propagation of market status, scores, and resolution events across distributed worker nodes and the frontend terminal.
- **🛡️ Rate-Limit Resiliency**: Native Redis primitives ensure platform stability and protect against data inconsistency during high-throughput trading events.

### 💎 Premium UI/UX: The "Glow-Terminal"
The interface has been reimagined as a **"Glow-Terminal"**—a premium, data-dense experience designed for the professional trader.

- **✨ Aesthetic Excellence**: Built with a custom **Glow-Card System**, featuring curated HSL-tailored colors, smooth CSS micro-animations, and glassmorphic overlays that create a sense of depth and focus.
- **🔐 Zero-Knowledge UX**: Simplifies the complexities of ZK-proof generation into a seamless, 3-step workflow that ensures privacy without sacrificing speed or intuition.
- **🌊 Interactive Vibe**: Hover-triggered lighting effects and fluid, interactive dashboards create an interface that feels "alive," responding dynamically to every trader interaction.

### ✨ Gasless Transactions
Horizon now implements **Stellar Fee Bump** transactions! This allows users to place ZK bets completely gas-free. Our custom Relayer API handles the transaction submission and fee sponsorship.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Client ["Frontend (Next.js)"]
        UI["Horizon Terminal"]
        BM["BetModal (ZK Proof Gen)"]
        AP["Admin Panel (Bet Management)"]
        F["Freighter Wallet"]
    end

    subgraph Backend ["Server (Next.js API)"]
        API["REST API (/api/bets, /api/markets)"]
        Auth["Stellar Auth"]
        Relay["Relayer Service"]
    end

    subgraph Agents ["Agentic Market Engine"]
        Worker["BullMQ Worker (Node.js)"]
        AE["Agent Engine (Python/Gemini)"]
        TD["Topic Discovery"]
        MR["Market Resolver"]
    end

    subgraph Storage ["Data Layer"]
        DB[("PostgreSQL (Prisma)")]
        Redis[("Redis (BullMQ)")]
        LS["localStorage (ZK Portfolio)"]
    end

    subgraph Blockchain ["Stellar Network"]
        SC["Soroban Smart Contracts"]
        Ledger["Stellar Ledger"]
    end

    %% Interactions
    UI --> BM
    UI --> AP
    BM -- "1. Generate Proof" --> BM
    BM -- "2. Sign Transaction" --> F
    F -- "3. Submit to Chain" --> SC
    SC -- "4. Emit Event" --> Ledger
    Ledger -- "5. Index Event" --> Relay
    Relay -- "6. Update DB" --> DB
    API -- "Fetch Data" --> DB
    UI -- "Request Data" --> API
    BM -- "Store Nullifier" --> LS
    
    %% Agentic Flow
    API -- "Enqueue Job" --> Redis
    Redis -- "Pull Job" --> Worker
    Worker -- "Call" --> AE
    AE -- "Search & Analyze" --> TD
    AE -- "Resolve Markets" --> MR
    TD -- "Auto-Create" --> API
    MR -- "Submit Resolution" --> SC
```

---

## 📜 Smartcontract Details

Horizon's core logic is governed by a Soroban smart contract deployed on the Stellar Testnet.

- **Contract ID**: `CAIU27X7UNPW3ZOG27CQAFNZODL3F2DFVZRBUZS6G2NFX7WWANBXN356`
- **Network**: Stellar Testnet
- **Explorer**: [Stellar.Expert View](https://stellar.expert/explorer/testnet/contract/CAIU27X7UNPW3ZOG27CQAFNZODL3F2DFVZRBUZS6G2NFX7WWANBXN356)

### Contract Deployment Screenshot
![Stellar Expert Screenshot](./screenshots/contract.png)

---

## 🌟 Project Vision

Horizon's mission is to build the world's most trusted, private, and intelligence-driven prediction market ecosystem. We believe that **Privacy is a Human Right**, and in the realm of prediction markets, it is the key to preventing manipulation and ensuring that the "Wisdom of the Crowd" is truly unbiased.

*   **Decentralized Truth**: Leveraging Stellar's immutable ledger to create a transparent source of record for global events.
*   **Privacy by Default**: Using Zero-Knowledge Proofs to protect individual strategies and positions.
*   **Intelligence-First**: Moving beyond simple betting to provide high-fidelity sentiment analysis and risk metrics.
*   **Global Empowerment**: Providing anyone, anywhere, with the tools to hedge against future uncertainty.

---

## 🚀 Future Scope

The journey has just begun. Our roadmap for the next 12-18 months includes:

1.  **🤖 Horizon AI Curator**: Integrating Large Language Models to automatically create markets from real-time news feeds and manage liquidity.
2.  **🌐 Cross-Chain ZK-Rollups**: Expanding Horizon's privacy primitives to Ethereum, Polygon, and beyond via decentralized bridges.
3.  **📱 Mobile-Native Experience**: A high-performance mobile app featuring biometric-secured ZK proof generation and instant push alerts.
4.  **🏦 Institutional Liquidity Pools**: Specialized vaults for market makers and institutional hedgers with advanced risk management tools.
5.  **🛰️ Decentralized Oracle Network**: A bespoke oracle system utilizing multi-party computation (MPC) for automated and dispute-free resolutions.
6.  **🎮 Gamified Prediction Tiers**: Introducing reputation-based tiers, social trading leaderboards, and ZK-verified performance badges.

---

### 🖼️ UI Screenshots

#### 💎 Updated UI Terminal (Glow-Terminal)
![Horizon Updated UI](./screenshots/updated_ui.png)

#### 🚀 Main Dashboard
![Horizon Dashboard](./screenshots/dashboard.png)

#### 🌍 Global Markets
![Global Markets](./screenshots/markets.png)

#### 📊 Market Overview & Analysis
![Market Overview](./screenshots/market_overview.png)

#### 📱 Responsive Design (Mobile Ready)
<img src="./screenshots/responsive_ui.jpeg" width="300" alt="Responsive UI" />

#### 💼 User Portfolio
![Portfolio](./screenshots/portfolio.png)

#### 🏆 Leaderboard
![Leaderboard](./screenshots/leaderboard.png)

#### 🔐 Admin Panel: Transaction Stream
![Admin Transactions](./screenshots/admin_transactions.png)

#### ⚖️ Admin Panel: Market Resolution
![Admin Resolution](./screenshots/admin_resolution.png)

#### ⛓️ On-Chain ZK Transaction
![ZK Transaction](./screenshots/zktxn.png)

---

## 📝 User Onboarding & Feedback

We value community input and actively iterate on our platform based on user experiences. We have scaled to 30+ verified active users. 

[![Review Project](https://img.shields.io/badge/Review-Project-orange?style=for-the-badge&logo=googleforms)](https://forms.gle/2gkJTvdxtBmSaDmU8)
[![Feedback Sheet](https://img.shields.io/badge/Feedback-Sheet-blue?style=for-the-badge&logo=googlesheets)](https://docs.google.com/spreadsheets/d/1ZWrlcff79a274MHBfSEh__zPHHFg-faftsk7UUYXess/edit?resourcekey=&gid=510073230#gid=510073230)

### 👥 Table 1: Onboarded Users (Level 5 & Level 6)

| User Name | User Email | User Wallet Address |
| :--- | :--- | :--- |
| **Rohit Acharya** | `rohitacharya25@gmail.com` | [`GCFJQCTGFO5QXE5F6TYFRARFDX3O2GXSJ56N37ZBEX4V5LQYQKU54IQH`](https://stellar.expert/explorer/testnet/account/GCFJQCTGFO5QXE5F6TYFRARFDX3O2GXSJ56N37ZBEX4V5LQYQKU54IQH) |
| **Deep Saha** | `sdeep027@gmail.com` | [`GAPZFL43CLQZUZTVH4XGC7XPY7WGWD7RI2D4E2IQGFDFVYZN4BI7GMVL`](https://stellar.expert/explorer/testnet/account/GAPZFL43CLQZUZTVH4XGC7XPY7WGWD7RI2D4E2IQGFDFVYZN4BI7GMVL) |
| **Sumit Sarkar** | `sumit087@gmail.com` | [`GAVAIWLB3PBWMVKPDHLDVRAS7VH4DA2SXW3W2G7V5QLJ6DK3HY3AJVAN`](https://stellar.expert/explorer/testnet/account/GAVAIWLB3PBWMVKPDHLDVRAS7VH4DA2SXW3W2G7V5QLJ6DK3HY3AJVAN) |
| **Samrat Natta** | `samratnatta993@gmail.com` | [`GBTLRERJBUOHFIIZCHAOTXSSQ2UF5BU6WFYMXCMHY672II75LXXB3FAI`](https://stellar.expert/explorer/testnet/account/GBTLRERJBUOHFIIZCHAOTXSSQ2UF5BU6WFYMXCMHY672II75LXXB3FAI) |
| **Nilarpan Jana** | `nnilarpan@gmail.com` | [`GCQM3XP3IWUY3LCPDIP4QRLB7VIL2DY2QLZJ2KG2NANWUAFAZ3ULECUQ`](https://stellar.expert/explorer/testnet/account/GCQM3XP3IWUY3LCPDIP4QRLB7VIL2DY2QLZJ2KG2NANWUAFAZ3ULECUQ) |
| **Tanaj Das** | `tdas06@gmail.com` | [`GDZR3O22WSIJRT25KIIY4UYDJXFHME7BEEHDMCUT2TAEI6SR7L2B5MUY`](https://stellar.expert/explorer/testnet/account/GDZR3O22WSIJRT25KIIY4UYDJXFHME7BEEHDMCUT2TAEI6SR7L2B5MUY) |
| **Srijit Kundu** | `sgamer34@gmail.com` | [`GDVEBVTVNOD75J5AFRYJW7I2IPT2Q7AJOUCRB6F7C753MIH4MYQANTVI`](https://stellar.expert/explorer/testnet/account/GDVEBVTVNOD75J5AFRYJW7I2IPT2Q7AJOUCRB6F7C753MIH4MYQANTVI) |
| **Sambhas Maiti** | `sambhasmaiti03@gmail.com` | [`GDTDI2OH76ATUC6HUDAX3KUK74AMIL33BVNFJG2UBTBFJXOXQ2PNU53A`](https://stellar.expert/explorer/testnet/account/GDTDI2OH76ATUC6HUDAX3KUK74AMIL33BVNFJG2UBTBFJXOXQ2PNU53A) |
| **Samrat Trader** | `mamotadasmamotadas@gmail.com` | [`GCRG5UZWUAFUEC67XU4Q6GUYLA4OGR3EBKEVFMXTJ34HI6QTQAP6T7L7`](https://stellar.expert/explorer/testnet/account/GCRG5UZWUAFUEC67XU4Q6GUYLA4OGR3EBKEVFMXTJ34HI6QTQAP6T7L7) |
| **Cosmeon Trader** | `nilarpanj@gmail.com` | [`GAIQM3ISTUYHANMIJ2ZYUCLGALE6UYWYIORVS7XA43YJ6WAHWZW2XR7G`](https://stellar.expert/explorer/testnet/account/GAIQM3ISTUYHANMIJ2ZYUCLGALE6UYWYIORVS7XA43YJ6WAHWZW2XR7G) |
| **Sylvia Barick** | `taniabarick15@gmail.com` | [`GBYOEY63WVKXY5KTSQZG4FGCDYY2CV7K3SH4ZSVN6IFDWJ464HPFIEIQ`](https://stellar.expert/explorer/testnet/account/GBYOEY63WVKXY5KTSQZG4FGCDYY2CV7K3SH4ZSVN6IFDWJ464HPFIEIQ) |
| **Nitesh Jana** | `niteshjana11@gmail.com` | [`GCKL2H6GSQ5XB5OZE2IAVFKIYZ3XCEUEXPWRME2EO4UYPUFDAA2INWJW`](https://stellar.expert/explorer/testnet/account/GCKL2H6GSQ5XB5OZE2IAVFKIYZ3XCEUEXPWRME2EO4UYPUFDAA2INWJW) |
| **Sumit Dey** | `sumitdey456@gmail.com` | [`GARFTDEIFIAD34FRNTLESZEXSCROQVPT76WZVA5WKPQ5UREDF3BTCYMK`](https://stellar.expert/explorer/testnet/account/GARFTDEIFIAD34FRNTLESZEXSCROQVPT76WZVA5WKPQ5UREDF3BTCYMK) |
| **Sayan Koley** | `sayankoley.trader@gmail.com` | [`GCVSH65WNB6IM3LPC5DMEEY5WXQ5ISX62STSGBYIRKRWSEMZ4S2LHPD7`](https://stellar.expert/explorer/testnet/account/GCVSH65WNB6IM3LPC5DMEEY5WXQ5ISX62STSGBYIRKRWSEMZ4S2LHPD7) |
| **Arnab Jana** | `arnabjan99@gmail.com` | [`GCQVBE7IDEBEL7RCLYFYKKUK3YD4VKVYYXXZFHPSJ63KWDSPCIADJKEL`](https://stellar.expert/explorer/testnet/account/GCQVBE7IDEBEL7RCLYFYKKUK3YD4VKVYYXXZFHPSJ63KWDSPCIADJKEL) |
| **Sneha Chakraborty** | `snehachakraborty21@gmail.com` | [`GAVTHBVKWAS7WBUN2NHROAGK376VDDRUZ5GYQVMDMUNLAYPS7EPXLWHX`](https://stellar.expert/explorer/testnet/account/GAVTHBVKWAS7WBUN2NHROAGK376VDDRUZ5GYQVMDMUNLAYPS7EPXLWHX) |
| **Avik Banerjee** | `avikbanerjee08@gmail.com` | [`GBVPJ2TF6KS6OESEBU3HGXNMFHNWWLI4FYAYU63EH6HKQRBMP45DWTJH`](https://stellar.expert/explorer/testnet/account/GBVPJ2TF6KS6OESEBU3HGXNMFHNWWLI4FYAYU63EH6HKQRBMP45DWTJH) |
| **Trailokya Nath Roy** | `trailokyanroy@gmail.com` | [`GDFM62TGZ3RDCK7M2DJDW35QDPWC65GVHVX63JYGHQQUYXWYMZYG4PR7`](https://stellar.expert/explorer/testnet/account/GDFM62TGZ3RDCK7M2DJDW35QDPWC65GVHVX63JYGHQQUYXWYMZYG4PR7) |
| **Debashis Bhattacharya**| `debashis.bhat07@gmail.com` | [`GAEYXWJUKWF6KQPCN6WWJMIO5KARFGZ54UEM572JONF2W5TUAUNCEPXO`](https://stellar.expert/explorer/testnet/account/GAEYXWJUKWF6KQPCN6WWJMIO5KARFGZ54UEM572JONF2W5TUAUNCEPXO) |
| **Subhrajit Mandal** | `subhrajitmandal2k@gmail.com`| [`GAKD4A6VJLWXN2WOD4ICDECH7DUTPTKMXXR522P2S6WS4LTA5WQKPNO6`](https://stellar.expert/explorer/testnet/account/GAKD4A6VJLWXN2WOD4ICDECH7DUTPTKMXXR522P2S6WS4LTA5WQKPNO6) |
| **Pranab Chatterjee** | `pranabchat01@gmail.com` | [`GBG25BTFV5NHSBCMTM7U2AMN27SBDRGR5ZXRJ5EDIL4MCG62L2ST5Z7P`](https://stellar.expert/explorer/testnet/account/GBG25BTFV5NHSBCMTM7U2AMN27SBDRGR5ZXRJ5EDIL4MCG62L2ST5Z7P) |
| **Babai Chakraborty** | `babai.chakra@gmail.com` | [`GC5VDVJDUYWPANLIOTNDSKR34JYISLULHLKIYRG7ER6TCRMNCWYQWEBA`](https://stellar.expert/explorer/testnet/account/GC5VDVJDUYWPANLIOTNDSKR34JYISLULHLKIYRG7ER6TCRMNCWYQWEBA) |
| **Koushik Biswas** | `koushikbiswas77@gmail.com` | [`GAYIDOBUXAMHDEDMQIBSGYXFUVZLIW7ZM6S3NCVYFLDU6RS56SRA42ZJ`](https://stellar.expert/explorer/testnet/account/GAYIDOBUXAMHDEDMQIBSGYXFUVZLIW7ZM6S3NCVYFLDU6RS56SRA42ZJ) |
| **Alok Nath Sarkar** | `aloknathsarkar@gmail.com` | [`GBLU63FD4SKHEFU2TJVWOTB7L7ZZMCE2VERTYLRGGLIYTLBIRTX4ERFC`](https://stellar.expert/explorer/testnet/account/GBLU63FD4SKHEFU2TJVWOTB7L7ZZMCE2VERTYLRGGLIYTLBIRTX4ERFC) |
| **Alik Das** | `alikdas2003@gmail.com` | [`GDRSCM4LBC43CNRV3MI5Q3IV5PIMI3JCUQZTSGS3HCVUCTQTYGHXNUX6`](https://stellar.expert/explorer/testnet/account/GDRSCM4LBC43CNRV3MI5Q3IV5PIMI3JCUQZTSGS3HCVUCTQTYGHXNUX6) |
| **Guddu Sharma** | `guddu.sharma007@gmail.com` | [`GCRJPX6Z6ELK5TH3RQSB6LEFSTRV25OVSIWHTXEW5IKTW5J2PXZE2JPM`](https://stellar.expert/explorer/testnet/account/GCRJPX6Z6ELK5TH3RQSB6LEFSTRV25OVSIWHTXEW5IKTW5J2PXZE2JPM) |
| **Quazi Rahul** | `quazirahul.trader@gmail.com` | [`GBV2VSXKD6CY3XNZOVKIWAEXBHYU3XDQWOGOZSFI27SDCA6SGST73ZBQ`](https://stellar.expert/explorer/testnet/account/GBV2VSXKD6CY3XNZOVKIWAEXBHYU3XDQWOGOZSFI27SDCA6SGST73ZBQ) |
| **Aniket Mukherjee** | `aniketmukh2024@gmail.com` | [`GBAEHJGSF4DVGBMXOTWWHNAMRX2DXET66D4ZB5GGTO2MFB2NRC3BMKSS`](https://stellar.expert/explorer/testnet/account/GBAEHJGSF4DVGBMXOTWWHNAMRX2DXET66D4ZB5GGTO2MFB2NRC3BMKSS) |
| **Mrityunjay Mondal** | `mrityunjay.mondal@gmail.com` | [`GACGOQPB3GXBQOE4FSOOKQVOK7AZXD75IQTWUSPF6C7TYXATN2ZQ6HSJ`](https://stellar.expert/explorer/testnet/account/GACGOQPB3GXBQOE4FSOOKQVOK7AZXD75IQTWUSPF6C7TYXATN2ZQ6HSJ) |
| **Shinzo Das** | `shinzodas99@gmail.com` | [`GA7PQOUEGWQTVKYNO4GXKBEE7H6LQE7GYTYSGQ4AIIRFBWPXJIBEUJJF`](https://stellar.expert/explorer/testnet/account/GA7PQOUEGWQTVKYNO4GXKBEE7H6LQE7GYTYSGQ4AIIRFBWPXJIBEUJJF) |

### 💬 Table 2: User Feedback Implementation

| User Name | User Email | User Wallet Address | User Feedback | Commit ID |
| :--- | :--- | :--- | :--- | :--- |
| **Sumit Sarkar** | `sumit087@gmail.com` | [`GAVAIWLB3PBWMVKPDHLDVRAS7VH4DA2SXW3W2G7V5QLJ6DK3HY3AJVAN`](https://stellar.expert/explorer/testnet/account/GAVAIWLB3PBWMVKPDHLDVRAS7VH4DA2SXW3W2G7V5QLJ6DK3HY3AJVAN) | Reduce the loading time of the app | [`8512a70`](https://github.com/Subho4531/eventhorizon/commit/8512a701af4e1d0ed5ad562ab6ed00602d4d08f2) (Local Caching for faster loading) |
| **Rohit Acharya** | `rohitacharya25@gmail.com` | [`GCFJQCTGFO5QXE5F6TYFRARFDX3O2GXSJ56N37ZBEX4V5LQYQKU54IQH`](https://stellar.expert/explorer/testnet/account/GCFJQCTGFO5QXE5F6TYFRARFDX3O2GXSJ56N37ZBEX4V5LQYQKU54IQH) | ADD Live Trading Events that are most recent | [`d394fc9`](https://github.com/Subho4531/eventhorizon/commit/d394fc9d37a4a8261337f10ee467986aab9c5752) (Agentic AI implementation for live events) |
| **Deep Saha** | `sdeep027@gmail.com` | [`GAPZFL43CLQZUZTVH4XGC7XPY7WGWD7RI2D4E2IQGFDFVYZN4BI7GMVL`](https://stellar.expert/explorer/testnet/account/GAPZFL43CLQZUZTVH4XGC7XPY7WGWD7RI2D4E2IQGFDFVYZN4BI7GMVL) | AI Probability score shows wrong | [`8e9234c`](https://github.com/Subho4531/eventhorizon/commit/8e9234ce8863a163a24af305b3fdd06c337e3585) (Fixed agent pipeline and probability logic) |
| **Nilarpan Jana** | `nnilarpan@gmail.com` | [`GCQM3XP3IWUY3LCPDIP4QRLB7VIL2DY2QLZJ2KG2NANWUAFAZ3ULECUQ`](https://stellar.expert/explorer/testnet/account/GCQM3XP3IWUY3LCPDIP4QRLB7VIL2DY2QLZJ2KG2NANWUAFAZ3ULECUQ) | UX can be improve | [`467815a`](https://github.com/Subho4531/eventhorizon/commit/467815a3525baae1d2a6d41366f7c89e360bbff4) (Improved dashboard visuals & UX) |
| **Subhrajit Mandal** | `subhrajitmandal2k@gmail.com` | [`GAKD4A6VJLWXN2WOD4ICDECH7DUTPTKMXXR522P2S6WS4LTA5WQKPNO6`](https://stellar.expert/explorer/testnet/account/GAKD4A6VJLWXN2WOD4ICDECH7DUTPTKMXXR522P2S6WS4LTA5WQKPNO6) | The UI is clean, just fix minor bugs | [`d4ddcef`](https://github.com/Subho4531/eventhorizon/commit/d4ddceffa4c27c4c52150e81df756f7afb144e8e) (Updated dashboard and fixed minor UI errors) |

### 🔮 Next Phase Improvements (Based on Feedback)
Based on the collected user feedback in our Level 6 cohort, we plan to evolve the project with the following updates:
1. **Live Trading Events**: Users requested more real-time notifications and live events for recent markets. We will introduce WebSocket-driven market subscriptions in our next iteration (Commit tracking: [`931e9a3`](https://github.com/Subho4531/eventhorizon/commit/931e9a3)).
2. **Further Performance Tweaks**: We will introduce a more optimized WASM client to address mobile loading speed concerns raised by users (Commit tracking: [`7e0ec4b`](https://github.com/Subho4531/eventhorizon/commit/7e0ec4b)).
3. **Enhanced Advanced AI Modeling**: Updating the Python agents to provide better AI probability accuracy out-of-the-box (Commit tracking: [`56c9ffc`](https://github.com/Subho4531/eventhorizon/commit/56c9ffc)).
4. **Community Features**: Adding a portfolio tracker and chat/forum capabilities to enhance the trader experience (Commit tracking: [`f42bf0c`](https://github.com/Subho4531/eventhorizon/commit/f42bf0c), [`bc89083`](https://github.com/Subho4531/eventhorizon/commit/bc89083)).

---

## 🎖️ Level 6 Requirements Checklist

- [x] **30+ verified active users**: Onboarded and tracked via Google Sheets.
- [x] **Metrics Dashboard Live**: Track DAU, transactions, and retention.
- [x] **Security Checklist Completed**: [View Security Checklist](https://github.com/Subho4531/eventhorizon/SECURITY.md)
- [x] **Monitoring Active**: System health and RPC metrics are actively monitored.
- [x] **Data Indexing Implemented**: Custom Relayers + Prisma Postgres sync.
- [x] **Full Documentation**: Present in this README.
- [x] **Community Contribution**: [Twitter Post (Horizon Agentic Release)](https://x.com/jeet_xtweet/status/2049868407529697743?s=20)
- [x] **Advanced Feature Implemented**: **Fee Sponsorship (Gasless transactions via fee bump)**
- [x] **Minimum 15+ Meaningful Commits**: Maintained actively.

### 🌟 Advanced Feature: Fee Sponsorship

Horizon now implements **Stellar Fee Bump** transactions! This allows users to place ZK bets completely gas-free. Our custom Relayer API handles the transaction submission and fee sponsorship.

![Fee Sponsorship Architecture](./screenshots/gasfees_paidbysource.png)

### 📢 Community Contribution

As part of scaling our product and engaging the broader Stellar ecosystem, we actively promoted Horizon on our social channels!

![Community Contribution](./screenshots/twitterpost_community%20contribution.png)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL instance
- Freighter Wallet extension

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Subho4531/eventhorizon.git
   cd eventhorizon
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

4. **Database Migration**:
   ```bash
   npx prisma migrate dev
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 🛠️ Tech Stack
Horizon is built using a modern, high-performance stack optimized for security and scale.

- **Frontend**: ![Next.js](https://img.shields.io/badge/Next.js-15-000?style=flat&logo=next.js) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?style=flat&logo=tailwind-css) ![Framer Motion](https://img.shields.io/badge/Framer-0055FF?style=flat&logo=framer)
- **Blockchain**: ![Stellar](https://img.shields.io/badge/Stellar-7D4698?style=flat&logo=stellar) ![Soroban](https://img.shields.io/badge/Soroban-FFD700?style=flat&logo=rust) ![Freighter](https://img.shields.io/badge/Freighter-FF4B00?style=flat)
- **Backend**: ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma)
- **Agentic Engine**: ![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python) ![Gemini AI](https://img.shields.io/badge/Gemini--AI-4285F4?style=flat&logo=google-gemini) ![BullMQ](https://img.shields.io/badge/BullMQ-FF4B00?style=flat) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis)
- **Database**: ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql)
- **Security**: ![ZK-Proofs](https://img.shields.io/badge/ZK--Proofs-FF69B4?style=flat) ![Circuit](https://img.shields.io/badge/Circom-gray?style=flat)
- **Testing**: ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest)

---

## 📂 Project Structure

```text
├── app/               # Next.js App Router (Pages & API)
├── components/        # Reusable UI components
├── contracts/         # Soroban Smart Contracts (Rust)
├── lib/               # Shared utilities & blockchain logic
├── prisma/            # Database schema & migrations
├── public/            # Static assets
├── scripts/           # Deployment & maintenance scripts
└── tests/             # Unit & integration tests
```

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing a bug, suggesting a feature, or improving documentation, your help is appreciated.

1.  **Fork** the repository.
2.  **Create a branch** (`git checkout -b feature/AmazingFeature`).
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).
4.  **Push** to the branch (`git push origin feature/AmazingFeature`).
5.  **Open a Pull Request**.

---

## 📜 License

This project is licensed under the MIT License.

---
<p align="center">Made with ❤️ for the Stellar Ecosystem</p>
