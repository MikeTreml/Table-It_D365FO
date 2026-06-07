# Chrome Web Store Listing Copy

Use this as paste-ready copy for the Chrome Web Store Developer Dashboard.

## Item Details

Name:

```text
Table It D365FO
```

Short description:

```text
Browse Microsoft Dynamics 365 Finance & Operations tables, entities, metadata, and OData records.
```

Category:

```text
Developer Tools
```

Language:

```text
English
```

Homepage URL:

```text
https://github.com/MikeTreml/Table-It_D365FO
```

Support URL:

```text
https://github.com/MikeTreml/Table-It_D365FO/issues
```

Privacy policy URL:

```text
https://miketreml.github.io/Table-It_D365FO/privacy-policy.html
```

## Detailed Description

```text
Table It D365FO helps developers, analysts, administrators, and consultants browse Microsoft Dynamics 365 Finance & Operations table and entity information directly from Chrome.

Use it to search bundled D365FO table metadata, inspect live OData entities from a configured environment, view entity fields, build OData URLs, open entity records, and explore table/entity relationships.

Key features:

- Search Dynamics 365 Finance & Operations tables by name, label, module, table group, and related metadata
- Browse live OData entities from a configured D365FO environment
- View public collection names, entity categories, DMF details, editability, and change tracking metadata
- Inspect entity fields and field capabilities
- Build and open OData query URLs
- View entity data using the user's existing D365FO browser session
- Explore table and entity relationships
- Save local environment profiles, preferences, and favorites

Table It D365FO uses the user's existing Dynamics 365 Finance & Operations session in Chrome. It does not ask for passwords and does not provide its own token or login flow.

This extension is intended for users who are authorized to access the Dynamics 365 Finance & Operations environments they configure.
```

## Beta Description Add-On

Use this only while publishing as a private/trusted-tester beta.

```text
THIS EXTENSION IS FOR BETA TESTING.

Please report issues, missing metadata, and unexpected D365FO behavior through the project support link.
```

## Privacy Tab

Single purpose:

```text
Table It D365FO helps users browse Microsoft Dynamics 365 Finance & Operations tables, data entities, metadata, relations, and OData query results from environments they configure.
```

Remote code:

```text
No, this extension does not execute remotely hosted code.
```

Data use:

```text
The extension stores user-configured Dynamics 365 environment settings, company/language preferences, theme preferences, and favorites in Chrome storage. It sends HTTPS requests to the user's configured Dynamics 365 Finance & Operations environment to display metadata and data in the extension UI. The publisher does not receive, sell, or use this data for advertising.
```

## Permission Justifications

`storage`:

```text
Used to save user-configured Dynamics 365 environment profiles, company and language preferences, theme settings, and favorites.
```

`tabs`:

```text
Used to open extension pages and focus an existing Table It D365FO tab when users invoke extension shortcuts or navigation actions.
```

`https://*.dynamics.com/*`:

```text
Used to request metadata, entity lists, field metadata, and OData records from Microsoft Dynamics 365 Finance & Operations environments selected by the user.
```

## Suggested Screenshot Captions

Popup:

```text
Search D365FO tables and open common extension tools from the popup.
```

Tables:

```text
Browse bundled Dynamics 365 Finance & Operations table metadata.
```

Entities:

```text
Inspect live OData and DMF metadata from a configured D365FO environment.
```

OData Builder:

```text
Build and open OData query URLs with selected fields and filters.
```

Relations:

```text
Explore table and entity relationships across the D365FO metadata graph.
```
