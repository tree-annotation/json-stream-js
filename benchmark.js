import {SymToJsonEvent} from './SymToJsonEvent.js'


export const JsonEventToDao = () => {
  let ret = ''
  let depth = 0

  // note: what is lost in translation: top-level padding
  //   commas, colons

  let buf = ''
  return {
    push: (event) => {
      // console.log(event)
      const {id} = event

      if (id === 'buffer') {
        buf += event.sym
      } else if (id === 'whitespace') {

      } else if (['open object', 'open array'].includes(id)) {
        ret += '['
        // buf = ''
      } else if (['close object', 'close array'].includes(id)) {
        ret += ']'
        // buf = ''
      } else if (id === 'string') {
        ret += '[' + JSON.parse(buf).replace(/(`|\[|\])/g, '`$1') + ']'
        buf = ''
      } else if (id === 'number') {
        ret += '[' + buf + ']'
        buf = ''
      } else if (['true', 'false', 'null'].includes(id)) {
        ret += '[' + id + ']'
        buf = ''
      } else if (id === 'key') {
        ret += JSON.parse(buf).replace(/(`|\[|\])/g, '`$1')
        buf = ''
      } else if (['comma', 'colon'].includes(id)) {
      } else throw Error(`unrecognized event ${id}`)
    },
    end: (event) => {
      const r = ret
      ret = ''
      // console.assert(event.id === 'end')
      // ret += ws(event.wsBuffer)
      // console.log('dtao', ret)
      return r
    },
  }
}

const bsample = `{
     "firstName": "John",
     "lastName" : "Smith",
     "age"      : 25,
     "address"  :
     {
         "streetAddress": "21 2nd Street",
         "city"         : "New York",
         "state"        : "NY",
         "postalCode"   : "10021"
     },
     "phoneNumber":
     [
         {
           "type"  : "home",
           "number": "212 555-1234"
         },
         {
           "type"  : "fax",
           "number": "646 555-4567"
         }
     ]
 }`

const next = {push: () => {}, end: () => {}}
// const stream = SymToJsonEvent(next)
const stream = SymToJsonEvent(JsonEventToDao())

let lastRet
console.time('bench')
for (let i = 0; i < 100000; ++i) {
  for (let i = 0; i < bsample.length; ++i) {
    stream.push(bsample[i])
  }
  lastRet = stream.end()
  stream.reset()
}
console.timeEnd('bench')
console.log(lastRet)
// vs clarinet
// https://github.com/dscape/clarinet/blob/master/bench/results/sync/dscape-wikipedia.csv