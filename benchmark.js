import { JsonEventToDao } from './JsonEventToDao.js'
import {SymToJsonEvent} from './SymToJsonEvent.js'

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