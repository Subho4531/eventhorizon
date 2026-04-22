# 🌌 Horizon: Privacy-First Prediction Markets on Stellar

Horizon is a next-generation prediction market platform built on the Stellar blockchain, leveraging Soroban smart contracts and Zero-Knowledge (ZK) proofs to ensure trader privacy while providing high-fidelity market intelligence.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://horizonx-ten.vercel.app/markets)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-black?style=for-the-badge&logo=github)](https://github.com/Subho4531/eventhorizon)
![Stellar](https://img.shields.io/badge/Stellar-Soroban-blueviolet?style=for-the-badge&logo=stellar)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)

---

## 📖 Project Description

Horizon redefines prediction markets by prioritizing user privacy and data integrity. By integrating **Zero-Knowledge Proofs (ZKPs)** on the **Stellar Network**, Horizon allows users to take positions on global events without revealing their specific bets until the market is resolved. This prevents front-running and manipulation, creating a fairer ecosystem for all participants.

---

## ✨ Key Features

- **🔐 Privacy via ZK Proofs**: All bets are placed as ZK commitments. Positions remain private until the "Reveal" phase.
- **⚡ Stellar/Soroban Integration**: High-speed, low-cost settlement using Stellar's latest smart contract engine.
- **📊 Intelligence Dashboard**: Real-time analysis of market quality, risk scores, and sentiment trends.
- **🛡️ Secure Escrow**: Non-custodial escrow contracts manage user funds with cryptographic certainty.
- **🔍 Manipulation Detection**: Automated systems flag suspicious trading patterns to ensure market health.

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

    subgraph Storage ["Data Layer"]
        DB[("PostgreSQL (Prisma)")]
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

To establish the gold standard for decentralized prediction markets where privacy is not a luxury, but a fundamental right. Horizon aims to empower the global community with a transparent yet private platform for forecasting the future.

---

## 🚀 Future Scope

1.  **AI Market Curator**: Automated market creation and liquidity provisioning using LLMs.
2.  **Cross-Chain Bridging**: Expanding to other ZK-friendly ecosystems like Ethereum (L2) and Polygon.
3.  **Mobile App**: Immersive mobile experience with hardware-level ZK proof generation.
4.  **Advanced Oracle Network**: Integration with decentralized oracle providers for automated resolution.

---

### 🖼️ UI Screenshots

#### 🚀 Main Dashboard
![Horizon Dashboard](./screenshots/dashboard.png)

#### 🌍 Global Markets
![Global Markets](./screenshots/markets.png)

#### 📊 Market Overview & Analysis
![Market Overview](./screenshots/market_overview.png)

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

## 📝 User Feedback

We value community input and actively iterate on our platform based on user experiences.

**[View Full User Feedback Response Sheet](https://docs.google.com/spreadsheets/d/1ZWrlcff79a274MHBfSEh__zPHHFg-faftsk7UUYXess/edit?resourcekey=&gid=510073230#gid=510073230)**

### 💬 Feedback Summary & Implementation

| User Name | User Wallet Address | User Feedback | Commit ID |
| :--- | :--- | :--- | :--- |
| **Nilarpan Jana** | `GCQM3X...Z3ULECUQ` | Appreciated unique markets and security. Suggested UX navigation tweaks. | [`6bbb519`](https://github.com/Subho4531/eventhorizon/commit/6bbb519) |
| **Sumit Sarkar** | `GAVAIW...H3AJVAN` | Excellent decentralization focus. Suggested optimizing app loading times. | [`8512a70`](https://github.com/Subho4531/eventhorizon/commit/8512a70) |

> [!TIP]
> We actively monitor the [User Feedback Response Sheet](https://docs.google.com/spreadsheets/d/1ZWrlcff79a274MHBfSEh__zPHHFg-faftsk7UUYXess/edit?resourcekey=&gid=510073230#gid=510073230) for continuous improvements.

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

- **Frontend**: ![Next.js](https://img.shields.io/badge/Next.js-000?style=flat&logo=next.js) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?style=flat&logo=tailwind-css) ![Framer Motion](https://img.shields.io/badge/Framer-0055FF?style=flat&logo=framer)
- **Blockchain**: ![Stellar](https://img.shields.io/badge/Stellar-7D4698?style=flat&logo=stellar) ![Soroban](https://img.shields.io/badge/Soroban-FFD700?style=flat&logo=rust) ![Freighter](https://img.shields.io/badge/Freighter-FF4B00?style=flat)
- **Backend**: ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma)
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
