# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Release History

| Version | Date | Summary | Details |
|---------|------|---------|---------|
| **Unreleased** | - | 🎵 MusicBrainz Integration & Function Calling | AI can now fetch real song data from MusicBrainz for accurate release dates and album information |
| **[0.9.7_beta](changelog/0.9.7_beta.md)** | 2026-01-30 | 🎨 Unicode Text Normalization & Character Mapping | Remaps decorative Unicode to standard ASCII characters before sending questions to the ML models in order to prevent model confusion, character mapping management |
| **[0.9.6_beta](changelog/0.9.6_beta.md)** | 2026-01-29 | 🤖 Gemma Model Migration & Enhanced ML | Dynamic Gemma model discovery, refined prompts, song history tracking, turn token cleaning, time formatting fixes |
| **[0.9.5_beta](changelog/0.9.5_beta.md)** | 2025-11-20 | 🗄️ SQLite Database Integration | Historical data storage, song tracking, conversation logs, persistent data across restarts |
| **[0.9.1_beta](changelog/0.9.1_beta.md)** | 2025-11-13 | 🐛 Permission Fixes & Chat Command Enhancements | Fixed coOwner permissions, added chat command list feature, cleaned up redundant code |
| **[0.9.0_beta](changelog/0.9.0_beta.md)** | 2025-11-12 | 🎉 Chat Command Management System & Image Validation Tool | Full CRUD for chat commands, image validation, improved message handling |
| **[0.8.5_beta](changelog/0.8.5_beta.md)** | 2025-10-28 | 🤖 Enhanced AI System with Triggers & Tokens | AI personality, command triggers, advanced token system, CometChat reliability |
| **[0.8.1_beta](changelog/0.8.1_beta.md)** | 2025-10-21 | 📝 Improved Edit Command System | Better template management with listing and showing capabilities |
| **[0.8.0_beta](changelog/0.8.0_beta.md)** | 2025-10-17 | 🎵 Machine Learning Commands | AI-powered song facts, year detection, band info, meaning analysis |
| **[0.7.0_beta](changelog/0.7.0_beta.md)** | 2025-10-12 | 🎛️ Command & Feature Management | Enable/disable commands and features, announcements, help improvements |
| **[0.6.0_alpha](changelog/0.6.0_alpha.md)** | 2025-10-06 | 💬 Private Message Support | Full private message commands, improved message processing |
| **[0.5.0_alpha](changelog/0.5.0_alpha.md)** | 2025-09-25 | 🐳 Docker Deployment | Complete containerization with Docker Compose |
| **[0.4.6_alpha](changelog/0.4.6_alpha.md)** | 2025-09-20 | 🔧 Startup & Documentation Fixes | Fixed startup sequence, room name updates, bookmarklet token extraction |
| **[0.4.5_alpha](changelog/0.4.5_alpha.md)** | 2025-09-02 | 🖼️ Image Message Support | New sendGroupPictureMessage function |
| **[0.4.4_alpha](changelog/0.4.4_alpha.md)** | 2025-08-27 | ⚙️ Bot Configuration Management | Moved bot appearance settings from .env to data.json (BREAKING) |
| **[0.4.3_alpha](changelog/0.4.3_alpha.md)** | 2025-08-25 | 🎯 Welcome Message Customization | Edit welcome messages, DataService introduction |
| **[0.4.2_alpha](changelog/0.4.2_alpha.md)** | 2025-08-24 | 🔐 Role-Based Access Control | StateService, hierarchical permissions, standardized command structure |
| **[0.4.0_alpha](changelog/0.4.0_alpha.md)** | 2025-08-21 | 📋 Improved Environment Setup | Changed COMETCHAT_APP_ID to COMETCHAT_AUTH_TOKEN (BREAKING) |
| **[0.3.0_alpha](changelog/0.3.0_alpha.md)** | 2025-08-21 | 👍 Voting Features | Automatic upvote, improved socket logging |
| **[0.2.0_alpha](changelog/0.2.0_alpha.md)** | 2025-08-19 | 🔄 State Management & Voting | JSON patch-based state, voting functionality |
| **[0.1.0_alpha](changelog/0.1.0_alpha.md)** | 2025-08-19 | 🚀 Initial Alpha Release | Core bot framework, CometChat integration, test suite |

---

## Release Types

- **Major** (X.y.z) - Breaking changes that require migration
- **Minor** (x.Y.z) - New features that are backward compatible  
- **Patch** (x.y.Z) - Bug fixes and small improvements
- **Alpha** (x.y.z-alpha) - Pre-release versions for testing, may have breaking changes

## Beta Release Notice

This project is currently in **beta development**. Beta releases mean:

- Core functionality is stable and well-tested
- APIs and interfaces are relatively stable but may have minor changes
- Features are feature-complete but may have edge cases or minor bugs
- Suitable for testing and non-critical use, but not recommended for production
- Feedback and bug reports are welcome
- Documentation should be relatively complete

The project will transition to stable releases (1.0.0+) when the API is considered stable, thoroughly tested, and production-ready, and all core features are complete.

## Change Categories

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

## Links

- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [Repository](https://github.com/jodrell2000/mrRobotoV3)
