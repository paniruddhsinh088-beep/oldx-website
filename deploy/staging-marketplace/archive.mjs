// INACTIVE TEMPLATE: relocation to root api/ requires explicit approval.
import {createStagingHandler} from '../../functions/staging-marketplace/bootstrap.mjs';
export default createStagingHandler({operation:'archive',env:process.env});
