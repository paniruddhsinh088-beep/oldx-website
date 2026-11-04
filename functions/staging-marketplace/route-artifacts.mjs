// Pure packaging manifest. Deliberately does NOT write root api/ or deploy.
export function stagingMarketplaceRouteArtifacts(){
 return Object.freeze(Object.fromEntries(['save','owner','archive'].map(operation=>[
  `api/staging/marketplace/${operation}.mjs`,
  `import {createStagingHandler} from '../../../functions/staging-marketplace/bootstrap.mjs';\nexport default createStagingHandler({operation:'${operation}',env:process.env});\n`
 ])));
}
