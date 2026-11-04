import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createStagingMandatoryPhotoPolicy} from './mandatory-photo-policy.mjs';
import {createStagingAtomicPhotoPublication} from './firebase-atomic-photo-publication.mjs';
import {createStagingPhotoReferenceRepository} from './firebase-photo-reference-repository.mjs';
import {createStagingMediaJournal} from './firebase-media-journal.mjs';
import {createStagingPublicMediaRead} from './firebase-media-delivery-read.mjs';
import {createMediaDeliveryContract} from './media-delivery-contract.mjs';
// Same transaction/policy code as isolated adapters. No provider call, fake scan,
// public activation or automatic SDK initialization. Product/Store only.
export function createStagingMarketplaceMedia({enabled=false,binding,authenticate,verifyProof,authorizeOrphan,now=Date.now}={}){
 if(enabled!==true)return null;const b=requireStagingMarketplaceBinding(binding),options={enabled:true,binding:b,authenticate,verifyProof,authorizeOrphan,now};
 const readPublicSnapshot=createStagingPublicMediaRead(options);
 return Object.freeze({photoPolicy:createStagingMandatoryPhotoPolicy(options),atomicPhotos:createStagingAtomicPhotoPublication(options),references:createStagingPhotoReferenceRepository(options),journal:createStagingMediaJournal(options),readPublicSnapshot,delivery:createMediaDeliveryContract({enabled:true,readPublicSnapshot,now})});
}
