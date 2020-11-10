# DBoM Node SDK

The DBoM SDK for Node.js provides a high level API to interact with a DBoM node. The SDK is designed to be used in the Node.js JavaScript runtime.

<!-- TABLE OF CONTENT -->
## Table of Content

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Development](#development)
- [Usage](#usage)
  - [Create and Update Asset](#create-and-update-asset)
  - [Attach or Detach SubAsset](#attach-or-detach-subasset)
  - [Validate or Audit the Asset](#validate-or-audit-the-asset)
- [Docs](#docs)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

To build and test, the following prerequisites must be installed first:

- Node.js, version 12 is supported from 12.13.1 and higher
- npm tool version 6 or higher

### Development

Clone the project and launch the following commands to install the dependencies and perform various tasks.

In the project root folder:

- Install all dependencies via `npm install`
- To run the unit tests, use `npm run test`

<!-- USAGE EXAMPLES -->
## Usage

To use the node SDK within the dbom repository, go into your directory and `npm link` the SDK's directory

**Example:**

Install the dbom-sdk

```shell script
npm install @dbom/sdk
```

The DBoM SDK can now be imported:

```javascript
const DbomNode = require('@dbom/sdk');
let dNode = new DbomNode('<gateway-uri>', '<signing-service-uri>');
```

### Create and Update Asset

```javascript
let repoID = 'DB1',
    channelID = 'C1',
    assetID = 'ABC01',
    assetBody = {
        "standardVersion": 1.0,
        "documentName": "BoM for CPU Core i5 3500k",
        "documentCreator": "Intel FAB California",
        "documentCreatedDate": "2020-03-19",
        "assetType": "HardwareComponent",
        "assetSubType": "CPUUnit",
        "assetManufacturer": "Intel Corporation",
        "assetModelNumber": "BX80677I57500",
        "assetDescription": "Core i5 3500k Desktop Processor",
        "assetMetadata": {
            "clockSpeed": "3.4Ghz",
            "cpuSocket": "LGA 1151",
            "physicalCoreCount": "4",
            "supportedMemoryType": "DDR4SDRAM",
            "packageWattage": "65",
            "packageWeight": "340g"
        },
        "manufactureSignature": "wsBcBAEBCAAQBQJecxBBCRDhB93OjBXccAAAlAQH/0N2HhaK6fmADG0QxK9i8xIrgncGzvii6OqPzyVtyjA7RrpgA1c5E5wN5eW8XmPaqpMvtP3RenuTlXTH2d647QnzdxYuNOKjVXGuweBMkBqnKBf8hHeH6adBTh6Jlnbt3OndMsE06BMBz59Z/X4tmKoAWXox1EPraAi9+A6BqeB5YHXDQJ6SXsW9fLKoQVECsi0MHOR+CjGcu1R1dyP5s2Vd9jcm+DLXLmxz6zTqS7h1neLMsFm4jIhxYsh5mQ49R4r6Yi76RIMK5G6LxX32BzKb9rTDSKdqRFQAv4JsoZXTPRwlM3MG/FCQWYhtvc6righlAMJOVSXTxy54TPKeXe4==SVL1"
    };

(async () => {
    try {
        // Create an asset
        await dNode.createAsset(repoID, channelID, assetID, assetBody);

        // Retrive the asset from the gateway
        let asset = await dNode.getAsset(repoID, channelID, assetID);

        // Update the asset
        asset.assetMetadata.supportedMemoryType = 'DDR5SDRAM';
        await dNode.updateAsset(repoID, channelID, assetID, assetBody);
    } catch (e) {
        console.log('ERROR:', e);
    }
})();
```

### Attach or Detach SubAsset

```javascript
// Attaches a child asset to the provided parent asset
let attachRes = await attachSubasset(parentRepoID, parentChannelID, parentAssetID,
    childRepoID, childChannelID, childAssetID,
    role, subRole);
console.log(attachRes);

// Detaches a child asset from the provided parent asset
let detachRes = await detachSubasset(parentRepoID, parentChannelID, parentAssetID,
    childRepoID, childChannelID, childAssetID);
console.log(detachRes);
```

### Validate or Audit the Asset

```javascript
// Validates the manufacturer signature of an asset via the DBoM Node
let validate = await dNode.validateAsset(repoID, channelID, assetID);
console.log(validate);

// Get the audit trail of an asset via the DBoM Node
let audit = await dNode.auditAsset(repoID, channelID, assetID);
console.log(audit);
```

<!-- DOCUMENTATION -->
## Docs

The SDK is annotated with JSDoc Comments. In order to generate HTML documentation run:

```shell script
npm run generate-docs
```

## Getting help

If you have any queries on the dbom-node-sdk, feel free to reach us on any of our [communication channels](https://github.com/DBOMproject/community/blob/master/COMMUNICATION.md) 

If you have questions, concerns, bug reports, etc, please file an issue in this repository's [Issue Tracker](https://github.com/DBOMproject/node-sdk/issues).

## Getting involved

This section should detail why people should get involved and describe key areas you are
currently focusing on; e.g., trying to get feedback on features, fixing certain bugs, building
important pieces, etc.

General instructions on _how_ to contribute should be stated with a link to [CONTRIBUTING](CONTRIBUTING.md).

