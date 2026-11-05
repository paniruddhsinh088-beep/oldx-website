// Pure packaging manifest. Deliberately does NOT write root api/ or deploy.
export function stagingMarketplaceRouteArtifacts(){
 return Object.freeze(Object.fromEntries(['save','owner','archive'].map(operation=>[
  `api/staging/marketplace/${operation}.mjs`,
  `import {createStagingHandler} from '../../../functions/staging-marketplace/bootstrap.mjs';\nexport default createStagingHandler({operation:'${operation}',env:process.env});\n`
 ])));
}

// Default-disabled templates; no SDK/credential bootstrap is implied. Operators
// must approve and inject the verified media runtime before copying any routes.
export function stagingMediaRouteArtifacts(){
 return Object.freeze(Object.fromEntries(['upload','ownerPhotos','status','recover','remove','reconcileUpload','reconcileDelete'].map(operation=>[
  `api/staging/media/${operation}.mjs`,
  `import {createMediaFetchHandler} from '../../../functions/staging-marketplace/media-handler.mjs';\nexport default createMediaFetchHandler({operation:'${operation}'});\n`
 ])));
}
