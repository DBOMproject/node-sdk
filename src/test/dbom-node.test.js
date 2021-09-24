/* eslint-disable no-unused-expressions */
/*
 * Copyright 2020 Unisys Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const chai = require('chai');

const {
  expect,
} = chai;
const sinon = require('sinon');
const moxios = require('moxios');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const DBoMNode = require('../dbom-node');
const {
  GatewayError,
  AssetOrChannelNotFound,
  AssetInvalid,
  AssetNotAttached,
  AssetAlreadyExists,
  AssetAlreadyAttached,
  ParentAssetOrChannelNotFound,
  ChildAssetOrChannelNotFound,
  SigningServiceError,
} = require('../errors');

describe('dbom node', () => {
  let dbom;
  let dbom1;

  beforeEach(() => {
    moxios.install();
    dbom = new DBoMNode('gatewayURI');
    dbom1 = new DBoMNode('gatewayURI', 'signServiceURI');
  });

  after(() => {
    moxios.uninstall();
  });

  const axiosMock = (status, response, done) => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent();
      request.respondWith({
        status,
        response,
      })
        .then(() => {
          done();
        });
    });
  };

  context('dbom instance', () => {
    it('should create instance of DBoM Node with no sign service URI specified', () => {
      expect(dbom).to.be.instanceOf(DBoMNode);
      expect(dbom).to.have.ownProperty('gatewayURI').to.equal('gatewayURI');
      expect(dbom).to.have.ownProperty('signServiceURL').to.be.null;
      expect(dbom).to.have.ownProperty('signedAssetValidator');
      expect(dbom).to.have.ownProperty('unsignedAssetValidator');
    });

    it('should create instance of DBoM Node with sign service URI specified', () => {
      expect(dbom1).to.be.instanceOf(DBoMNode);
      expect(dbom1).to.have.ownProperty('gatewayURI').to.equal('gatewayURI');
      expect(dbom1).to.have.ownProperty('signServiceURL').to.equal('http://signServiceURI/pgp/sign');
      expect(dbom1).to.have.ownProperty('signedAssetValidator');
      expect(dbom1).to.have.ownProperty('unsignedAssetValidator');
    });

    it('should create an instance of DBoM node with API keys configured within axios', () => {
      const dbomNodeWithApiKey = new DBoMNode('gatewayURI', undefined, 'apikey');
      expect(dbomNodeWithApiKey).to.be.instanceOf(DBoMNode);
      expect(dbomNodeWithApiKey).to.have.ownProperty('gatewayURI').to.equal('gatewayURI');
      expect(dbomNodeWithApiKey).to.have.ownProperty('signServiceURL').to.be.null;
      expect(dbomNodeWithApiKey).to.have.ownProperty('axios');
      expect(dbomNodeWithApiKey.axios.defaults.headers).to.have.ownProperty('x-api-key');
    });
  });

  context('getAsset', () => {
    it('should retrive the asset', (done) => {
      moxios.wait(() => {
        const request = moxios.requests.mostRecent();
        request.respondWith({
          status: 200,
          response: 'stubResponse',
        })
          .then(() => {
            done();
          });
      });
      dbom.getAsset('repoID', 'channelID', 'assetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
    });

    it('should return asset not found error', (done) => {
      moxios.wait(() => {
        const request = moxios.requests.mostRecent();
        request.respondWith({
          status: 404,
          response: 'stubResponse',
        })
          .then(() => {
            done();
          });
      });
      expect(dbom.getAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(AssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      moxios.wait(() => {
        const request = moxios.requests.mostRecent();
        request.respondWith({
          status: 500,
          response: 'stubResponse',
        })
          .then(() => {
            done();
          });
      });
      expect(dbom.getAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(GatewayError);
    });
  });

  context('_signAsset', () => {
    it('should sign the asset', (done) => {
      const stubPayload = {
        assetType: 'type',
        assetMetadata: {},
      };
      const stubResponse = {
        signature: 'signature',
        fingerprint: 'fingerprint',
      };
      axiosMock(200, stubResponse, done);
      dbom1._signAsset(stubPayload).then((resolve) => {
        expect(resolve).to.eql({
          assetType: 'type',
          assetMetadata: {
            manufactureFingerprint: 'fingerprint',
          },
          manufactureSignature: 'signature',
        });
      });
    });

    it('should delete filtered payload manufactureFingerprint and sign the asset', (done) => {
      const stubPayload = {
        assetType: 'type',
        assetMetadata: {
          manufactureFingerprint: 'manufactureFingerprint',
        },
      };
      const stubResponse = {
        signature: 'signature',
        fingerprint: 'fingerprint',
      };
      axiosMock(200, stubResponse, done);
      dbom1._signAsset(stubPayload).then((resolve) => {
        expect(resolve).to.eql({
          assetType: 'type',
          assetMetadata: {
            manufactureFingerprint: 'fingerprint',
          },
          manufactureSignature: 'signature',
        });
      });
    });

    it('should return unspecified URI signing service error', () => {
      const stubPayload = {
        assetType: 'type',
        assetMetadata: {},
      };
      expect(dbom._signAsset(stubPayload)).to.be.rejectedWith(SigningServiceError);
    });

    it('should return signing service error', (done) => {
      const stubPayload = {
        assetType: 'type',
        assetMetadata: {},
      };
      axiosMock(500, 'stubResponse', done);
      expect(dbom1._signAsset(stubPayload)).to.be.rejectedWith(SigningServiceError);
    });

    it('should return signing service error with no response', (done) => {
      const stubPayload = {
        assetType: 'type',
        assetMetadata: {},
      };
      const stub = sinon.stub(dbom1.axios, 'post').throws(new Error());
      expect(dbom1._signAsset(stubPayload)).to.be.rejectedWith(SigningServiceError);
      expect(stub.calledOnce).to.be.true;
      stub.restore();
      done();
    });
  });

  context('_pushToGateway', () => {
    it('should push to gateway with sign service URI specified', (done) => {
      const stubPayload = {
        standardVersion: 1.0,
        documentName: 'documentName',
        documentCreator: 'documentCreator',
        documentCreatedDate: 'documentCreatedDate',
        assetType: 'assetType',
        assetSubType: 'assetSubType',
        assetManufacturer: 'assetManufacturer',
        assetModelNumber: 'assetModelNumber',
        assetDescription: 'assetDescription',
        assetMetadata: {},
      };
      const stub = sinon.stub(dbom1, '_signAsset').callsFake(() => {
        const signResponse = {
          signature: 'signature',
          fingerprint: 'fingerprint',
        };
        stubPayload.manufactureSignature = signResponse.signature;
        stubPayload.assetMetadata.manufactureFingerprint = signResponse.fingerprint;
        return stubPayload;
      });
      axiosMock(200, 'stubResponse', done);
      dbom1._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false).then((resolve) => {
        expect(resolve.data).to.equal('stubResponse');
        expect(stub.calledOnce).to.be.true;
        expect(stub.calledWith(stubPayload)).to.be.true;
        stub.restore();
      });
      dbom1._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true).then((resolve) => {
        expect(resolve.data).to.equal('stubResponse');
        expect(stub.calledTwice).to.be.true;
        expect(stub.calledWith(stubPayload)).to.be.true;
        stub.restore();
      });
    });

    it('should push to gateway with no sign service URI specified', (done) => {
      const stubPayload = {
        standardVersion: 1.0,
        documentName: 'documentName',
        documentCreator: 'documentCreator',
        documentCreatedDate: 'documentCreatedDate',
        assetType: 'assetType',
        assetSubType: 'assetSubType',
        assetManufacturer: 'assetManufacturer',
        assetModelNumber: 'assetModelNumber',
        assetDescription: 'assetDescription',
        assetMetadata: {},
        manufactureSignature: 'manufactureSignature',
      };
      axiosMock(200, 'stubResponse', done);
      dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false).then((resolve) => {
        expect(resolve.data).to.equal('stubResponse');
      });
      dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true).then((resolve) => {
        expect(resolve.data).to.equal('stubResponse');
      });
    });

    it('should return signed asset validator error', (done) => {
      // stubPayload with missing required fields
      const stubPayload = {
        standardVersion: 'standardVersion',
        documentName: 'documentName',
        assetDescription: 'assetDescription',
        assetMetadata: {},
        manufactureSignature: 'manufactureSignature',
      };
      const stubResponse = {
        signature: 'signature',
        fingerprint: 'fingerprint',
      };
      axiosMock(200, stubResponse, done);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false)).to.be.rejectedWith(AssetInvalid);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true)).to.be.rejectedWith(AssetInvalid);
      expect(dbom1._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false)).to.be.rejectedWith(AssetInvalid);
      expect(dbom1._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true)).to.be.rejectedWith(AssetInvalid);
    });

    it('should return asset already exists error', (done) => {
      const stubPayload = {
        standardVersion: 1.0,
        documentName: 'documentName',
        documentCreator: 'documentCreator',
        documentCreatedDate: 'documentCreatedDate',
        assetType: 'assetType',
        assetSubType: 'assetSubType',
        assetManufacturer: 'assetManufacturer',
        assetModelNumber: 'assetModelNumber',
        assetDescription: 'assetDescription',
        assetMetadata: {},
        manufactureSignature: 'manufactureSignature',
      };
      axiosMock(409, 'stubResponse', done);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false)).to.be.rejectedWith(AssetAlreadyExists);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true)).to.be.rejectedWith(AssetAlreadyExists);
    });

    it('should return asset not found error', (done) => {
      const stubPayload = {
        standardVersion: 1.0,
        documentName: 'documentName',
        documentCreator: 'documentCreator',
        documentCreatedDate: 'documentCreatedDate',
        assetType: 'assetType',
        assetSubType: 'assetSubType',
        assetManufacturer: 'assetManufacturer',
        assetModelNumber: 'assetModelNumber',
        assetDescription: 'assetDescription',
        assetMetadata: {},
        manufactureSignature: 'manufactureSignature',
      };
      const stubResponse = {
        error: 'not found',
      };
      axiosMock(502, stubResponse, done);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false)).to.be.rejectedWith(AssetOrChannelNotFound);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true)).to.be.rejectedWith(AssetOrChannelNotFound);
    });

    it('should return asset already exists error', (done) => {
      const stubPayload = {
        standardVersion: 1.0,
        documentName: 'documentName',
        documentCreator: 'documentCreator',
        documentCreatedDate: 'documentCreatedDate',
        assetType: 'assetType',
        assetSubType: 'assetSubType',
        assetManufacturer: 'assetManufacturer',
        assetModelNumber: 'assetModelNumber',
        assetDescription: 'assetDescription',
        assetMetadata: {},
        manufactureSignature: 'manufactureSignature',
      };
      axiosMock(500, 'stubResponse', done);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, false)).to.be.rejectedWith(GatewayError);
      expect(dbom._pushToGateway('repoID', 'channelID', 'assetID', stubPayload, true)).to.be.rejectedWith(GatewayError);
    });
  });

  context('attachSubasset', () => {
    it('should attach subasset', (done) => {
      axiosMock(200, 'stubResponse', done);
      dbom.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
      dbom1.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
    });

    it('should return asset already attached error', (done) => {
      axiosMock(403, 'stubResponse', done);
      expect(dbom.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(AssetAlreadyAttached);
      expect(dbom1.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(AssetAlreadyAttached);
    });

    it('should return parent asset not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(ParentAssetOrChannelNotFound);
      expect(dbom1.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(ParentAssetOrChannelNotFound);
    });

    it('should return child asset not found error', (done) => {
      const stubResponse = {
        error: 'not found',
      };
      axiosMock(502, stubResponse, done);
      expect(dbom.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(ChildAssetOrChannelNotFound);
      expect(dbom1.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(ChildAssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(GatewayError);
      expect(dbom1.attachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(GatewayError);
    });
  });

  context('detachSubasset', () => {
    it('should detach subasset', (done) => {
      axiosMock(200, 'stubResponse', done);
      dbom.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
      dbom1.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
    });

    it('should return asset not attached error', (done) => {
      axiosMock(403, 'stubResponse', done);
      expect(dbom.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(AssetNotAttached);
      expect(dbom1.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(AssetNotAttached);
    });

    it('should return parent asset not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(ParentAssetOrChannelNotFound);
      expect(dbom1.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(ParentAssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(GatewayError);
      expect(dbom1.detachSubasset('parentRepoID', 'parentChannelID', 'parentAssetID',
        'childRepoID', 'childChannelID', 'childAssetID')).to.be.rejectedWith(GatewayError);
    });
  });

  context('createAsset', () => {
    it('should create asset with no sign service URI specified', async () => {
      const stub = sinon.stub(dbom, '_pushToGateway').returns({
        data: 'stubData',
      });
      const response = await dbom.createAsset('repoID', 'channelID', 'assetID', 'payload');

      expect(response).to.equal('stubData');
      expect(stub.calledOnce).to.be.true;
      expect(stub.calledWith('repoID', 'channelID', 'assetID', 'payload', false)).to.be.true;
      stub.restore();
    });

    it('should create asset with sign service URI specified', async () => {
      const stub = sinon.stub(dbom1, '_pushToGateway').returns({
        data: 'stubData',
      });
      const response = await dbom1.createAsset('repoID', 'channelID', 'assetID', 'payload');

      expect(response).to.equal('stubData');
      expect(stub.calledOnce).to.be.true;
      expect(stub.calledWith('repoID', 'channelID', 'assetID', 'payload', false)).to.be.true;
      stub.restore();
    });
  });

  context('updateAsset', () => {
    it('should update asset with no sign service URI specified', async () => {
      const stub = sinon.stub(dbom, '_pushToGateway').returns({
        data: 'stubData',
      });
      const response = await dbom.updateAsset('repoID', 'channelID', 'assetID', 'payload');

      expect(response).to.equal('stubData');
      expect(stub.calledOnce).to.be.true;
      expect(stub.calledWith('repoID', 'channelID', 'assetID', 'payload', true)).to.be.true;
      stub.restore();
    });

    it('should update asset with sign service URI specified', async () => {
      const stub = sinon.stub(dbom1, '_pushToGateway').returns({
        data: 'stubData',
      });
      const response = await dbom1.updateAsset('repoID', 'channelID', 'assetID', 'payload');

      expect(response).to.equal('stubData');
      expect(stub.calledOnce).to.be.true;
      expect(stub.calledWith('repoID', 'channelID', 'assetID', 'payload', true)).to.be.true;
      stub.restore();
    });
  });

  context('validateAsset', () => {
    it('should validate asset', (done) => {
      const stubResponse = {
        valid: true,
      };
      axiosMock(200, stubResponse, done);
      dbom.validateAsset('repoID', 'channelID', 'assetID').then((resolve) => {
        expect(resolve).to.equal(true);
      });
      dbom1.validateAsset('repoID', 'channelID', 'assetID').then((resolve) => {
        expect(resolve).to.equal(true);
      });
    });

    it('should return asset not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom.validateAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(AssetOrChannelNotFound);
      expect(dbom1.validateAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(AssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom.validateAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(GatewayError);
      expect(dbom1.validateAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(GatewayError);
    });
  });

  context('auditAsset', () => {
    it('should return asset', (done) => {
      axiosMock(200, 'stubResponse', done);
      dbom.auditAsset('repoID', 'channelID', 'assetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
      dbom1.auditAsset('repoID', 'channelID', 'assetID').then((resolve) => {
        expect(resolve).to.equal('stubResponse');
      });
    });

    it('should return asset not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom.auditAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(AssetOrChannelNotFound);
      expect(dbom1.auditAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(AssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom.auditAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(GatewayError);
      expect(dbom1.auditAsset('repoID', 'channelID', 'assetID')).to.be.rejectedWith(GatewayError);
    });
  });

  context('richQueryChannel', () => {
    it('should return Rich Query results', (done) => {
      axiosMock(200, 'stubResponse', done);
      dbom.queryAssets('repoID', 'channelID', {
        query: {},
      })
        .then((resolve) => {
          expect(resolve)
            .to
            .equal('stubResponse');
        });
      dbom1.queryAssets('repoID', 'channelID', {
        query: {},
      })
        .then((resolve) => {
          expect(resolve)
            .to
            .equal('stubResponse');
        });
    });

    it('should return channel not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom1.queryAssets('repoID', 'channelID', {
        query: {},
      }))
        .to
        .be
        .rejectedWith(AssetOrChannelNotFound);
      expect(dbom1.queryAssets('repoID', 'channelID', {
        query: {},
      }))
        .to
        .be
        .rejectedWith(AssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom1.queryAssets('repoID', 'channelID', {
        query: {},
      }))
        .to
        .be
        .rejectedWith(GatewayError);
      expect(dbom1.queryAssets('repoID', 'channelID', {
        query: {},
      }))
        .to
        .be
        .rejectedWith(GatewayError);
    });
  });

  context('listAssetsOnChannel', () => {
    it('should return channel asset responses', (done) => {
      axiosMock(200, 'stubResponse', done);
      dbom.listAssets('repoID', 'channelID')
        .then((resolve) => {
          expect(resolve)
            .to
            .equal('stubResponse');
        });
    });

    it('should return channel not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom.listAssets('repoID', 'channelID'))
        .to
        .be
        .rejectedWith(AssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom.listAssets('repoID', 'channelID'))
        .to
        .be
        .rejectedWith(GatewayError);
    });
  });

  context('listChannelsOnRepo', () => {
    it('should return channel asset responses', (done) => {
      axiosMock(200, 'stubResponse', done);
      dbom.listChannels('repoID')
        .then((resolve) => {
          expect(resolve)
            .to
            .equal('stubResponse');
        });
    });

    it('should return channel not found error', (done) => {
      axiosMock(404, 'stubResponse', done);
      expect(dbom.listChannels('repoID'))
        .to
        .be
        .rejectedWith(AssetOrChannelNotFound);
    });

    it('should return gateway error', (done) => {
      axiosMock(500, 'stubResponse', done);
      expect(dbom.listChannels('repoID'))
        .to
        .be
        .rejectedWith(GatewayError);
    });
  });
});
