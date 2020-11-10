class DbomError extends Error {
    constructor() {
        super()
        this.message = "An error occurred on the DBoM node and the operation could not be completed"
        this.status = 500
    }

    statusCode() {
        return this.status
    }
}

class GatewayError extends DbomError {
    constructor(status, error) {
        super()
        this.name = this.constructor.name
        this.message = 'A general gateway failure occured'
        this.status = status
        this.error = error
    }
}

class AssetNotFound extends DbomError {
    constructor() {
        super()
        this.name = this.constructor.name
        this.message = 'Asset was not found'
        this.status = 404
    }
}

class ParentAssetNotFound extends AssetNotFound {
    constructor() {
        super()
        this.name = this.constructor.name
        this.message = 'Parent asset was not found'
        this.status = 404
    }
}

class ChildAssetNotFound extends AssetNotFound {
    constructor() {
        super()
        this.name = this.constructor.name
        this.message = 'Child asset was not found'
        this.status = 404
    }
}

class AssetAlreadyExists extends DbomError {
    constructor() {
        super()
        this.name = this.constructor.name
        this.message = 'Asset already exists'
        this.status = 409
    }
}

class AssetAlreadyAttached extends DbomError {
    constructor() {
        super()
        this.name = this.constructor.name
        this.message = 'Child already attached to parent asset'
        this.status = 403
    }
}

class AssetNotAttached extends DbomError {
    constructor() {
        super()
        this.name = this.constructor.name
        this.message = 'Child is not attached to parent asset'
        this.status = 403
    }
}

class AssetInvalid extends DbomError {
    constructor(validityFailureCause, errors = null) {
        super()
        this.name = this.constructor.name
        this.message = `Asset Invalid: ${validityFailureCause}`
        this.errors = errors
        this.status = 400
    }
}

class SigningServiceError extends DbomError {
    constructor(signFailureCause) {
        super();
        this.name = this.constructor.name
        this.message = `Signing service failed: ${signFailureCause}`
        this.status = 500
    }
}


module.exports = {
    DbomError,
    AssetInvalid,
    AssetNotFound,
    ParentAssetNotFound,
    ChildAssetNotFound,
    SigningServiceError,
    AssetAlreadyExists,
    AssetNotAttached,
    AssetAlreadyAttached,
    GatewayError
}