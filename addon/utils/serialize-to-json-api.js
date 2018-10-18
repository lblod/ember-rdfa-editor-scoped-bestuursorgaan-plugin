export default function serializeToJsonApi(resource) {
    let serializedResource = resource.serialize({includeId: true});
    //This is because we're not sure uri is kept (due to bug in mu-cl-resources/or ember-ds?)
    serializedResource.data.attributes.uri = resource.uri;
    return serializedResource;
}
