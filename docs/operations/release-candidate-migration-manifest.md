# Release candidate migration manifest

This manifest freezes the 35-migration chain successfully rehearsed from an
empty database. Checksums are SHA-256 hashes of each `migration.sql` file.

| Migration | SHA-256 |
| --- | --- |
| `20251227220508_init` | `17e18e6dcd74d3391919a6dd0298d0a268a32ae59bbcf41b6648b2d0bee462a6` |
| `20251230033149_add_security_pack_audit` | `6ab36548f41133bdcebf3644ba9586dc1348f9f922e5b52587b7997adbe5c0aa` |
| `20260615173728_add_enums_for_core_status_fields` | `671cdca1470c6f973c447e112f24d4bb79a7f288e3b07e502e25f15125390a75` |
| `20260615181500_add_user_profile_role_enum` | `2dccedc625bf6c5da0f6f9f3fdb570b9d5457045c8d64dbc0a66f86db6a756f5` |
| `20260720000000_workspace_business_model` | `998083ebcf366f5685be56e58a0a8c9e81946780a9d9345fbdedc2a36d369712` |
| `20260720001000_workspace_management_v1` | `427b36647f30c130586c44cc3d9276ef97f17eb9d8ae6be67fefc4f64e2121b0` |
| `20260721020310_apply_workspace_management_v1` | `4531af7d42c2c47b0ad78e837ae03168a23c4a671f3ca652c3471c8274c56cfa` |
| `20260721093000_workspace_ai_foundation` | `97adfedb242edb9637448a7f8c20ba9d958de754fbe88fe20015d97ab8c77435` |
| `20260722000000_add_qualified_lead_behavior` | `10e888be108104c647152dd7154ca4649cbf2998af837e746e5ca2de6e5765ae` |
| `20260727000000_scheduling_production_foundation` | `3097e151d251fd27911731c91ee111deb148d009e4bf44123d149a3d2fea85b3` |
| `20260728000000_scheduling_workspace_settings` | `0009c2df17aa3412eb3032c57b073679bd2ead5dc8a6d6c6a091797e6ec04b11` |
| `20260728010000_workspace_teams_locations` | `b93f6921f5fbe58bedb947f039a78d55854cb5295b88f4ac5b167a72c551aab5` |
| `20260728020000_scheduling_recurrence_materialization` | `db463cf7d806167f33ed7fee6b7a1d0de651addfbd6adeb74b535708a602a3b0` |
| `20260728023000_scheduling_recurrence_hardening` | `7be5feba4089404bb19f166fd4cd5340804a1baeceb5b73a2e40490100a61182` |
| `20260728030000_scheduling_notifications_phase2` | `39a8abcfda111e7496f0c715dfc82d05e39307f00071a66c32bb2f36b961bef8` |
| `20260728040000_scheduling_google_calendar_phase3` | `df256848e26ce21a248c84b3d5f69dce4a38eb4a577ad8f19912d03a5e9ab831` |
| `20260728043000_scheduling_google_calendar_phase35` | `2617f3e71be37aa5d16d1d2178a948bb4fece4c4310d5fbc30d2511912196af2` |
| `20260728050000_calendar_connection_member_ownership` | `2f67d44a605e81434240f7f1b1eb2c1aaf5dc16e0fd6c771b2bb498b749a1542` |
| `20260728060000_calendar_provider_governance_phase2` | `2faa4c7bd5050e7738fd7649486758296d6c98694466f487473a813f4ccdc8db` |
| `20260803000000_workspace_integration_connections` | `f297d68cf185b634908612cc29f29de32aaffe7002703d99bde0cd5a18ccb41b` |
| `20260803010000_add_workspace_manager_role` | `38f93a2f62fc2c194678c127e20478a959116737038fbcf7ae5fcda48f3ba2fa` |
| `20260804000000_workspace_knowledge_persistence` | `aefc80c7e7d340357965a78a5b360b6ac3d7eddfede8c53bea755631ae498847` |
| `20260804010000_operational_intelligence_persistence` | `6dce15c3dc69b701a107460d318bc7c205655913d638f2c9da4bd98f2d793c00` |
| `20260807000000_simple_service_business_model` | `3bf429f65cf45250541cdb2e61234a51a1128c09d700eff7a52e0f7eca13e8ad` |
| `20260812000000_revenue_transactions` | `aee5f38079f9689cef9768af068f5126c8fd9ed058898eeac001b43975d8d369` |
| `20260813172051_apply_existing_revenue_transactions` | `80d195880db82301a609b3547dfc8fe62242643a2a5bc6a0937c8cbac8b369b4` |
| `20260813172911_billing_access_foundation` | `0898256b6ceb092bbb6129a394f776fa3ec547a95445bc46d4ecb8ac23c3e0e3` |
| `20260922000000_simple_automation_installations` | `6038bd9066b200ec58aec29a913853267b7008df67bd5d899b473de315a9f68b` |
| `20260922010000_simple_automation_execution` | `5a1867d3ba41efc1519d4a6caf7c40050dd3c47f9d08c993724d12ea00242966` |
| `20260922020000_durable_jobs_work_items` | `2494ee4da3a2fed865ab705abb7896f01b337b9e500fe263afde7baf61d6d8de` |
| `20260922030000_durable_customers` | `cc9b8e08613a4dbf6cc332e4d6efc1cd914de031b4d42cb4018b9b0d1636ba83` |
| `20260922040000_job_customer_relation` | `a12461fe02a68387eede178a45720a8620b3e71a1f2cb030637881c8a7e66365` |
| `20260922050000_durable_leads` | `8e8aa41f8eaee26167e14e189e7bdbdba64082c8c716baabbbc17bcbbe41bd7d` |
| `20260922060000_lead_customer_conversion` | `419120088091fa15f29fbdfef574881c3366c5be4987d050347938aade62b9bc` |
| `20260922070000_native_domain_events` | `9e7ab83543dc3727f143c5377e8c957ecab6d9e8a577d88a380f54327c9dda42` |

Any checksum or directory-set change invalidates the prior empty-database
rehearsal evidence and requires a new rehearsal before production migration.
