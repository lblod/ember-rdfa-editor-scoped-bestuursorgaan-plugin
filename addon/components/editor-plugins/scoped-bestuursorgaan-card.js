import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-card';
import InsertResourceRelationCardMixin from '@lblod/ember-generic-model-plugin-utils/mixins/insert-resource-relation-card-mixin';
import { findPropertiesWithRange } from '@lblod/ember-generic-model-plugin-utils/utils/meta-model-utils';
import { inject as service } from '@ember/service';
import { task, timeout } from 'ember-concurrency';

/**
* Card displaying a hint of the Scoped bestuursorgaan
*
* @module editor-scoped-bestuursorgaan-plugin
* @class ScopedBestuursorgaanCard
* @extends Ember.Component
*/
export default Component.extend(InsertResourceRelationCardMixin, {
  currentSession: service(),
  store: service(),

  layout,

  serializeToJsonApi(resource){
    let serializedResource = resource.serialize({includeId: true});
    //This is because we're not sure uri is kept (due to bug in mu-cl-resources/or ember-ds?)
    serializedResource.data.attributes.uri = resource.uri;
    return serializedResource;
  },

  getBestuursorganen: task(function * (){
    let currentBestuurseenheid = yield this.currentSession.get('group');
    let properties = yield findPropertiesWithRange(this.store, this.get('info.domainUri'), 'http://data.vlaanderen.be/ns/besluit#BestuursOrgaan');
    let query = {
      'filter[bestuurseenheid][id]': currentBestuurseenheid.id
    };
    let bestuursorganen = yield this.store.query('bestuursorgaan', query);
    let bestuursorganenProperties = [];
    bestuursorganen.forEach(b => {
      properties.forEach(p => {
        bestuursorganenProperties.push({'bestuursorgaan': b, 'property': p});
      });
    });
    this.set('bestuursorganenProperties', bestuursorganenProperties);

  }).restartable(),

  didReceiveAttrs() {
    this._super(...arguments);
    this.get('getBestuursorganen').perform();
  },

  actions: {
    async refer(data){
      let bestuursorgaanJsonApi = this.serializeToJsonApi(data.bestuursorgaan);
      let rdfaRefer = await this.getReferRdfa(data.property, bestuursorgaanJsonApi, data.bestuursorgaan.naam);
      this.editor.replaceNodeWithHTML(this.info.domNodeToUpdate , rdfaRefer, true);
      let mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/scoped-bestuursorgaan-card');
    },
    async extend(data){
      let bestuursorgaanJsonApi = this.serializeToJsonApi(data.bestuursorgaan);
      let rdfaExtended = await this.getExtendedRdfa(data.property, bestuursorgaanJsonApi);
      this.editor.replaceNodeWithHTML(this.info.domNodeToUpdate , rdfaExtended, true);
      let mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(this.get('location'), this.get('hrId'), 'editor-plugins/scoped-bestuursorgaan-card');
    }
  }
});
