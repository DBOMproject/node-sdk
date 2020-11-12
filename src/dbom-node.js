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

/**
 * Module that contains the DBoM Node Class that abstracts interactions
 * with the gateway and signing service
 * @module DbomNode
 */

const axios = require('axios').default;
const ajv = require('ajv');
const assetSchema = require('../json-schema/assetSchema');
const unsignedAssetSchema = require('../json-schema/assetSchemaUnsigned');
const {
  GatewayError,
  AssetNotFound,
  AssetInvalid,
  AssetNotAttached,
  AssetAlreadyExists,
  AssetAlreadyAttached,
  ParentAssetNotFound,
  ChildAssetNotFound,
  SigningServiceError,
} = require('./errors');

/** Class representing a DBoM Node. */
class DbomNode {
  /**
     * Create a new DBoM node Object
     * @param {string} gatewayURI - The URI of the gateway (without schema).
     * @param {string|null=} signServiceURI - The URI of the signing service. If not provided,
     * the SDK will not sign any of your payloads
     */
  constructor(gatewayURI, signServiceURI = null) {
    this.gatewayURI = gatewayURI;
    if (signServiceURI) this.signServiceURL = `http://${signServiceURI}/pgp/sign`;
    else this.signServiceURL = null;
    // eslint-disable-next-line new-cap
    this.signedAssetValidator = (new ajv()).compile(assetSchema);
    // eslint-disable-next-line new-cap
    this.unsignedAssetValidator = (new ajv()).compile(unsignedAssetSchema);
  }

  /**
     * Constructs Asset URL from the parameters.
     * @private
     * @param repoID - Repository ID of the repository where the asset is stored
     * @param channelID - Channel ID of the channel where the asset is stored
     * @param assetID - Asset ID of the asset
     * @returns {string} - Asset URL
     */
  _constructAssetURL(repoID, channelID, assetID) {
    return `http://${this.gatewayURI}/api/v1/repo/${repoID}/chan/${channelID}/asset/${assetID}`;
  }

  /**
     * Gets error code from axios exception
     * @private
     * @param e - Axios error object
     * @returns {number} - Status Code
     */
  _getErrorStatus(e) {
    return (e.response && e.response.status) ? e.response.status : 500;
  }

  /**
     * Get an asset from the gateway
     * @param repoID - Repository ID of the repository where the asset is stored
     * @param channelID - Channel ID of the channel where the asset is stored
     * @param assetID - Asset ID of the asset
     * @returns {Promise<*>}
     */
  async getAsset(repoID, channelID, assetID) {
    const requestURI = this._constructAssetURL(repoID, channelID, assetID);
    try {
      return (await axios.get(requestURI)).data;
    } catch (e) {
      const status = this._getErrorStatus(e);
      if (status === 404) throw new AssetNotFound();
      else throw new GatewayError(status, e.response.data);
    }
  }

  /**
     * Signs a payload by invoking the pgp signing service
     * @private
     * @param payload - javascript object to be signed
     * @returns {Promise<*>} - Signed object
     */
  async _signAsset(payload) {
    if (this.signServiceURL === null) throw new SigningServiceError('URI of signing service unspecified');
    const {
      attachedChildren,
      parentAsset,
      manufactureSignature,
      ...filteredPayload
    } = payload;

    if (filteredPayload.assetMetadata && filteredPayload.assetMetadata.manufactureFingerprint) {
      delete filteredPayload.assetMetadata.manufactureFingerprint;
    }
    try {
      const signatureResponse = await axios.post(this.signServiceURL, filteredPayload);
      const signedPayload = { ...payload };
      signedPayload.manufactureSignature = signatureResponse.data.signature;
      signedPayload.assetMetadata.manufactureFingerprint = signatureResponse.data.fingerprint;
      return signedPayload;
    } catch (e) {
      if (e.response && e.response.data) throw new SigningServiceError(e.response.data);
      else throw new SigningServiceError(e);
    }
  }

  /**
     * Pushes an asset to the gateway with a POST or PUT request
     *
     * @private
     * @param repoID - Repository ID of the repository where the asset is stored
     * @param channelID - Channel ID of the channel where the asset is stored
     * @param assetID - Asset ID of the asset
     * @param payload - JS object with asset body
     * @param isUpdate - if true, performs a PUT request
     * @returns {Promise<AxiosResponse<T>>} - Gateway Response
     */
  async _pushToGateway(repoID, channelID, assetID, payload, isUpdate = false) {
    let validPayload;
    if (this.signServiceURL !== null) validPayload = this.unsignedAssetValidator(payload);
    else validPayload = this.signedAssetValidator(payload);
    if (!validPayload) throw new AssetInvalid('Schema Invalid', this.signedAssetValidator.errors);

    let verifiedPayload = { ...payload };
    if (this.signServiceURL !== null) verifiedPayload = await this._signAsset(payload);

    const requestURI = this._constructAssetURL(repoID, channelID, assetID);
    try {
      if (isUpdate) return await axios.put(requestURI, verifiedPayload);
      return await axios.post(requestURI, verifiedPayload);
    } catch (e) {
      const status = this._getErrorStatus(e);
      if (status === 409) throw new AssetAlreadyExists();
      else if (status === 502 && e.response.data.error.includes('not found')) throw new AssetNotFound();
      else throw new GatewayError(status, e.response.data);
    }
  }

  /**
     * Attaches a child asset to the provided parent asset
     * @param parentRepoID -  Repository ID of the repository where the parent asset is stored
     * @param parentChannelID - Channel ID of the channel where the parent asset is stored
     * @param parentAssetID - Asset ID of the parent asset
     * @param childRepoID -  Repository ID of the repository where the child asset is stored
     * @param childChannelID - Channel ID of the channel where the child asset is stored
     * @param childAssetID - Asset ID of the child asset
     * @param role - The role assigned to the child asset
     * @param subRole The subrole assigned to the child asset
     * @returns {*} - Gateway Response
     */
  async attachSubasset(parentRepoID, parentChannelID, parentAssetID,
    childRepoID, childChannelID, childAssetID,
    role, subRole) {
    const requestURI = `${this._constructAssetURL(parentRepoID, parentChannelID, parentAssetID)}/attach`;
    const body = {
      role,
      subRole,
      repoID: childRepoID,
      channelID: childChannelID,
      assetID: childAssetID,
    };
    try {
      return (await axios.post(requestURI, body)).data;
    } catch (e) {
      const status = this._getErrorStatus(e);
      if (status === 403) throw new AssetAlreadyAttached();
      else if (status === 404) throw new ParentAssetNotFound();
      else if (status === 502 && e.response.data.error.includes('not found')) throw new ChildAssetNotFound();
      else throw new GatewayError(status, e.response.data);
    }
  }

  /**
     * Detaches a child asset from the provided parent asset
     * @param parentRepoID -  Repository ID of the repository where the parent asset is stored
     * @param parentChannelID - Channel ID of the channel where the parent asset is stored
     * @param parentAssetID - Asset ID of the parent asset
     * @param childRepoID -  Repository ID of the repository where the child asset is stored
     * @param childChannelID - Channel ID of the channel where the child asset is stored
     * @param childAssetID - Asset ID of the child asset
     * @returns {*} - Gateway Response
     */
  async detachSubasset(parentRepoID, parentChannelID, parentAssetID,
    childRepoID, childChannelID, childAssetID) {
    const requestURI = `${this._constructAssetURL(parentRepoID, parentChannelID, parentAssetID)}/detach`;
    const body = {
      repoID: childRepoID,
      channelID: childChannelID,
      assetID: childAssetID,
    };
    try {
      return (await axios.post(requestURI, body)).data;
    } catch (e) {
      const status = this._getErrorStatus(e);
      if (status === 403) throw new AssetNotAttached();
      else if (status === 404) throw new ParentAssetNotFound();
      else throw new GatewayError(status, e.response.data);
    }
  }

  /**
     * Creates a new asset via the DBoM node
     * @param repoID - Repository ID of the repository where the asset is to be stored
     * @param channelID - Channel ID of the channel where the asset is to be stored
     * @param assetID - Asset ID of the asset to be stored
     * @param payload - Body of the asset
     * @returns {*}
     */
  async createAsset(repoID, channelID, assetID, payload) {
    return (await this._pushToGateway(repoID, channelID, assetID, payload, false)).data;
  }

  /**
     * Updates an existing asset via the DBoM node
     * @param repoID - Repository ID of the repository where the asset is stored
     * @param channelID - Channel ID of the channel where the asset is stored
     * @param assetID - Asset ID of the asset
     * @param payload - Updated body of the asset
     * @returns {*}
     */
  async updateAsset(repoID, channelID, assetID, payload) {
    return (await this._pushToGateway(repoID, channelID, assetID, payload, true)).data;
  }

  /**
     * Validates the manufacturerSignature of an asset via the DBoM node
     * @param repoID - Repository ID of the repository where the asset is stored
     * @param channelID - Channel ID of the channel where the asset is stored
     * @param assetID - Asset ID of the asset
     * @returns {Promise<boolean>} - true if the asset is valid
     */
  async validateAsset(repoID, channelID, assetID) {
    let validateResponse;
    const requestURI = `${this._constructAssetURL(repoID, channelID, assetID)}/validate`;
    try {
      validateResponse = await axios.get(requestURI);
      return validateResponse.data.valid;
    } catch (e) {
      const status = this._getErrorStatus(e);
      if (status === 404) throw new AssetNotFound();
      else throw new GatewayError(status, e.response.data);
    }
  }

  /**
     * Get the audit trail of an asset via the DBoM Node
     * @param repoID - Repository ID of the repository where the asset is stored
     * @param channelID - Channel ID of the channel where the asset is stored
     * @param assetID - Asset ID of the asset
     * @returns {*} - The audit trail of the asset
     */
  async auditAsset(repoID, channelID, assetID) {
    const requestURI = `${this._constructAssetURL(repoID, channelID, assetID)}/trail`;
    try {
      return (await axios.get(requestURI)).data;
    } catch (e) {
      const status = this._getErrorStatus(e);
      if (status === 404) throw new AssetNotFound();
      else throw new GatewayError(status, e.response.data);
    }
  }
}

module.exports = DbomNode;
