import {SymToJsonEvent} from './SymToJsonEvent.js'
import { JsonEventToDao } from './JsonEventToDao.js'

for (const [input, expected] of [
  [' "" ', ""],
  ['{}', ''],
  ['[]', ''],
  ['{"a": "b"}', 'a [b]'],
  ['{"a": "b", "c": "d"}', 'a [b] c [d]'],
  ['{"z": {"a": "b", "c": "d"}}', 'z [a [b] c [d]]'],
  ['{"z": {"a": "b", "c": "d"}, "y": ["1", "2"]}', 'z [a [b] c [d]] y [[1] [2]]'],
  ['  { "z" : {  "a": "b", "c" : "d"} , "y": ["1", "2"] } ', ' z  [  a [b] c  [d]]  y [[1] [2]] '],
  ['  { "z" : {  "a": true, "c" : false} , "y": ["1", "2", null] } ', ' z  [  a [true] c  [false]]  y [[1] [2] [null]] '],
  ['[123.456e+12, -55.37, 5, 10.1, -12.34e-10, 0]', '[123.456e+12] [-55.37] [5] [10.1] [-12.34e-10] [0]'],
  ['123.456e+12 -55.37 5 10.1 -12.34e-10 0', '[123.456e+12] [-55.37] [5] [10.1] [-12.34e-10] [0]'],
  ['0', '0'],
  [' 1000 ', '1000'],
  [' "\\u1234" ', '\u1234'],
  [`
{
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
}`, `
    firstName [John]
    lastName  [Smith]
    age       [25]
    address  
    [
        streetAddress [21 2nd Street]
        city          [New York]
        state         [NY]
        postalCode    [10021]
    ]
    phoneNumber
    [
        [
          type   [home]
          number [212 555-1234]
        ]
        [
          type   [fax]
          number [646 555-4567]
        ]
    ]
`]
]) {
  const stream = SymToJsonEvent(JsonEventToDao())
  const syms = input.split('')
  for (const c of syms) {
    const ret = stream.push(c)
    // todo: early exit
    // if (ret.status === 'Status.mismatch') {
    //   console.assert(expected.mismatch === true, ret)
    //   console.log('early mismatch, as expected', input)
    //   break
    // }
  }
  const ret = stream.end()
  console.assert(ret === expected, `ret=<<<${ret}>>>`, `expected=<<<${expected}>>>`)
}