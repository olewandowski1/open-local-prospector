# Use Application-Owned, Extensible Business Discovery

Status: Superseded By [ADR 0012](0012-use-subscription-runtime-web-search.md)

The application will own business discovery rather than depending on whichever search capability a selected AI runtime happens to expose. The first working slice uses Brave Search API behind a `DiscoverySource` boundary, giving every runtime consistent inputs. Public place data, Polish business directories, and public social discovery will be added as later source adapters and merged through Business Identity resolution. Browser automation is reserved for inspecting discovered pages, not scraping consumer search-result interfaces.
