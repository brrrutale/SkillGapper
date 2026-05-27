/**
 * cosmos.js
 *
 * Singleton Cosmos-Client. Wird beim ersten Function-Call instanziiert und
 * fuer alle Folge-Calls wiederverwendet (Connection-Pooling).
 *
 * Erwartet:
 *   COSMOS_CONNECTION_STRING
 *   COSMOS_DATABASE   (default: "skillgapper")
 *   COSMOS_CONTAINER  (default: "projects")
 */

import { CosmosClient } from '@azure/cosmos';

let _container = null;

export function getContainer() {
    if (_container) return _container;
    const conn = process.env.COSMOS_CONNECTION_STRING;
    if (!conn) throw new Error('COSMOS_CONNECTION_STRING ist nicht gesetzt');
    const dbId = process.env.COSMOS_DATABASE || 'skillgapper';
    const cId = process.env.COSMOS_CONTAINER || 'projects';
    const client = new CosmosClient(conn);
    _container = client.database(dbId).container(cId);
    return _container;
}
