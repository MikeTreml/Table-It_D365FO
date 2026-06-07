# Table It D365FO Privacy Policy

Last updated: June 7, 2026

Table It D365FO is a Chrome extension for browsing Microsoft Dynamics 365 Finance & Operations tables, data entities, metadata, and OData query results from environments selected by the user.

## Information the extension uses

Table It D365FO stores extension settings locally in Chrome storage, including:

- Dynamics 365 Finance & Operations environment URL
- Default company and language settings
- Theme, color, and display preferences
- Favorites
- Local metadata caches used to improve extension performance

When a user connects to a Dynamics 365 Finance & Operations environment, the extension requests metadata and data from that environment over HTTPS. These requests may include Dynamics 365 authentication cookies already present in the user's browser session. The extension does not ask for, collect, store, or transmit passwords.

## How information is used

The extension uses stored settings and Dynamics 365 responses only to provide its user-facing features:

- Open and browse Dynamics 365 table and entity information
- Display field metadata, relations, and entity records
- Build and open OData query URLs
- Remember user preferences and favorites
- Cache metadata locally to reduce repeated metadata requests

## Information sharing

The extension does not sell user data, use user data for advertising, or send user data to the extension publisher.

The extension sends requests only to the Dynamics 365 Finance & Operations environment selected by the user. Data returned from that environment is displayed in the extension UI in the user's browser.

## Storage and retention

Extension settings and metadata caches are stored in Chrome storage on the user's device. Users can remove this data by clearing the extension's stored settings in Chrome, removing the extension, or using any reset/clear options provided by the extension.

## Security

The extension communicates with Dynamics 365 Finance & Operations environments using HTTPS. Users should only configure environments they trust and are authorized to access.

## Contact

For questions or support, use the project repository:

https://github.com/MikeTreml/Table-It_D365FO
