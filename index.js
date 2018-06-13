// @flow
/*:: type Request = {query: Object, get: Function, cookies: {adminmode?: string}} */;
/*:: type Response = {set: Function, json: Function, status: Function, end: Function} */;
/*:: type DynamoList = {length: number, lastKey: {}, scannedCount: number}*/

const _get = require('lodash.get');

function scanModelFields(Model/*: Object*/) {
  const searchFields = {};
  let attrs = {};
  if (Model['$__'] && typeof(Model['$__'].table.schema.attributes) === 'object') {
    attrs = Model['$__'].table.schema.attributes;
    Object.keys(attrs).forEach((attr) => {
      if (attrs[attr].options && typeof (attrs[attr].options.description) === 'string') {
        try {
          const conf = JSON.parse(attrs[attr].options.description);
          searchFields[attr] = conf.searchField;
        } catch(e) {
          console.log('Cannot parse field description', attrs[attr].options.description, ' of attr ', attr);
        }
      }
    });
  }

  return {
    attrs,
    searchFields
  }
}


function listWrapper(req/*: Request*/, res/*: Response*/) {
  return (Model/*: any*/)/*: Promise<{}>*/ => {
    //code.options.description


    const {searchFields, attrs} = scanModelFields(Model);

    console.log('searchFields', searchFields);
    const cursor = Model.scan();
    const lastKey = req.get('x-lastkey');
    const limit = req.query.per_page;
    const filter = req.query.filter;

    if (filter) {
      if (!Object.keys(searchFields).length) {
        console.log('Cannot apply filter without searchField');
      } else {
        const filterObj = JSON.parse(filter);
        console.log('searchField', searchFields, ' contains ', filter);
        Object.keys(filterObj).forEach(fieldName => {
          if (!searchFields[fieldName]) {
            throw new Error('Provided unknown search field' + fieldName);
          }
          console.log('where', fieldName, ' ', searchFields[fieldName], filterObj[fieldName]);
          cursor.where(fieldName)[searchFields[fieldName]](filterObj[fieldName]);
        });
        
      }
    }

    const fromCMS = (req.cookies && req.cookies.adminmode) || req.query.fromCMS;

    if (!fromCMS) {
      if (attrs.isActive) {
        cursor.where('isActive').eq('true');
      }
      if (attrs.state) {
        cursor.where('state').eq('published');
      }
    }

    if (lastKey && lastKey !== 'undefined') {
      try {
        const parsedLastKey = JSON.parse(lastKey);
        cursor.startAt(parsedLastKey);
      } catch (e) {
        console.log('Could not parse lastKey', lastKey, e);
      }
    }
    if (limit && !filter) {
      cursor.limit(limit);
    }
    return cursor;
  }
}

/*:: type AddFilter = (item: Object, req: Request) => Promise<any> */

function getOne(Model/*: Object*/, reqAcessor/*: string*/, conditionKey/*: string*/, additionalFilter/*: ?AddFilter*/) {
  return (req/*: Request*/, res/*: Response*/, next/*: (err: Error) => {} */) => {
    const {searchFields, attrs} = scanModelFields(Model);
    const fromCMS = (req.cookies && req.cookies.adminmode) || req.query.fromCMS;
    
    Model.get({
      [conditionKey]: _get(req, reqAcessor)
    }).then((data) => {
      if (!data) return null;
      if (!fromCMS) {
        if (attrs.isActive && data.isActive !== 'true') {
          console.log('item is failed to be isActive');
          return null;
        }
        if (attrs.state && data.state !== 'published') {
          console.log('item is failed to be published');
          return null;
        }
      }
      return data;
    }).then((result) => {
      if (!result) return null;
      if (additionalFilter) {
        return additionalFilter(result, req);
      }
      return result;
    }).then(result => {
      if (!result) {
        res.status(404);
        return res.end();
      }
      res.json(result);
    }).catch(next);
  }
}

function responseOneWrapper(res/*: Response*/) {
  return (item/*: ?Object*/) => {
    if (!item) {
      res.status(404);
      return res.end();
    }
    res.json(item);
  }
}

function updateObjectWrapper(req/*: Object*/, obj/*: {updatedBy? : string, updatedAt?: number}*/) {
  const user = req.apiGateway && req.apiGateway.event && req.apiGateway.event.requestContext && req.apiGateway.event.requestContext.identity && req.apiGateway.event.requestContext.identity.cognitoAuthenticationProvider;
  console.log(req, JSON.stringify(req.apiGateway));
  if (user) {
    obj.updatedBy = user;
  }
  obj.updatedAt = Date.now()
  return obj;
}

function responseWrapper(res/*: Response*/) {
  return (items/*: DynamoList*/) => {
    res.set('x-lastkey', JSON.stringify(items.lastKey));
    res.set('x-total-count', 1000000);
    res.set('Access-Control-Expose-Headers', 'x-total-count, x-lastkey');
    res.set('Access-Control-Allow-Methods', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.json(items);
    return items;
  }
}

module.exports = {
  responseOneWrapper,
  getOne,
  listWrapper,
  responseWrapper,
  updateObjectWrapper
}


/**
 * 
 *       if (req.query.sort) {
        try {
          const sort = JSON.parse(req.query.sort);
          if (sort[1] === 'DESC') {
            cursor.descending();
          }
        } catch (e) {
          console.log('Cannot parse sort parameter', req.query.sort);
        }
      }
 */