import * as topojson from 'topojson-client';

const TOPO_URLS = {
  'world': 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
  'us-states': 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
};

const TOPO_OBJECT_KEYS = {
  'world': 'countries',
  'us-states': 'states',
};

const geoCache = {};

export const COUNTRY_LOOKUP = {
  '004': 'Afghanistan', '008': 'Albania', '012': 'Algeria', '020': 'Andorra',
  '024': 'Angola', '028': 'Antigua and Barbuda', '032': 'Argentina', '051': 'Armenia',
  '036': 'Australia', '040': 'Austria', '031': 'Azerbaijan', '044': 'Bahamas',
  '048': 'Bahrain', '050': 'Bangladesh', '052': 'Barbados', '112': 'Belarus',
  '056': 'Belgium', '084': 'Belize', '204': 'Benin', '064': 'Bhutan',
  '068': 'Bolivia', '070': 'Bosnia and Herzegovina', '072': 'Botswana', '076': 'Brazil',
  '096': 'Brunei', '100': 'Bulgaria', '854': 'Burkina Faso', '108': 'Burundi',
  '116': 'Cambodia', '120': 'Cameroon', '124': 'Canada', '140': 'Central African Republic',
  '148': 'Chad', '152': 'Chile', '156': 'China', '170': 'Colombia',
  '174': 'Comoros', '178': 'Congo', '180': 'Democratic Republic of the Congo',
  '188': 'Costa Rica', '384': 'Ivory Coast', '191': 'Croatia', '192': 'Cuba',
  '196': 'Cyprus', '203': 'Czech Republic', '208': 'Denmark', '262': 'Djibouti',
  '212': 'Dominica', '214': 'Dominican Republic', '218': 'Ecuador', '818': 'Egypt',
  '222': 'El Salvador', '226': 'Equatorial Guinea', '232': 'Eritrea', '233': 'Estonia',
  '231': 'Ethiopia', '242': 'Fiji', '246': 'Finland', '250': 'France',
  '266': 'Gabon', '270': 'Gambia', '268': 'Georgia', '276': 'Germany',
  '288': 'Ghana', '300': 'Greece', '308': 'Grenada', '320': 'Guatemala',
  '324': 'Guinea', '328': 'Guyana', '332': 'Haiti', '340': 'Honduras',
  '348': 'Hungary', '352': 'Iceland', '356': 'India', '360': 'Indonesia',
  '364': 'Iran', '368': 'Iraq', '372': 'Ireland', '376': 'Israel',
  '380': 'Italy', '388': 'Jamaica', '392': 'Japan', '400': 'Jordan',
  '398': 'Kazakhstan', '404': 'Kenya', '410': 'South Korea', '414': 'Kuwait',
  '417': 'Kyrgyzstan', '418': 'Laos', '428': 'Latvia', '422': 'Lebanon',
  '426': 'Lesotho', '430': 'Liberia', '434': 'Libya', '440': 'Lithuania',
  '442': 'Luxembourg', '450': 'Madagascar', '454': 'Malawi', '458': 'Malaysia',
  '466': 'Mali', '470': 'Malta', '478': 'Mauritania', '480': 'Mauritius',
  '484': 'Mexico', '498': 'Moldova', '496': 'Mongolia', '499': 'Montenegro',
  '504': 'Morocco', '508': 'Mozambique', '104': 'Myanmar', '516': 'Namibia',
  '524': 'Nepal', '528': 'Netherlands', '554': 'New Zealand', '558': 'Nicaragua',
  '562': 'Niger', '566': 'Nigeria', '578': 'Norway', '512': 'Oman',
  '586': 'Pakistan', '591': 'Panama', '598': 'Papua New Guinea', '600': 'Paraguay',
  '604': 'Peru', '608': 'Philippines', '616': 'Poland', '620': 'Portugal',
  '634': 'Qatar', '642': 'Romania', '643': 'Russia', '646': 'Rwanda',
  '682': 'Saudi Arabia', '686': 'Senegal', '688': 'Serbia', '694': 'Sierra Leone',
  '702': 'Singapore', '703': 'Slovakia', '705': 'Slovenia', '706': 'Somalia',
  '710': 'South Africa', '724': 'Spain', '144': 'Sri Lanka', '729': 'Sudan',
  '740': 'Suriname', '748': 'Eswatini', '752': 'Sweden', '756': 'Switzerland',
  '760': 'Syria', '158': 'Taiwan', '762': 'Tajikistan', '834': 'Tanzania',
  '764': 'Thailand', '768': 'Togo', '780': 'Trinidad and Tobago', '788': 'Tunisia',
  '792': 'Turkey', '795': 'Turkmenistan', '800': 'Uganda', '804': 'Ukraine',
  '784': 'United Arab Emirates', '826': 'United Kingdom', '840': 'United States of America',
  '858': 'Uruguay', '860': 'Uzbekistan', '862': 'Venezuela', '704': 'Vietnam',
  '887': 'Yemen', '894': 'Zambia', '716': 'Zimbabwe',
};

export const US_STATE_LOOKUP = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
};

const US_STATE_ABBR = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08',
  'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15',
  'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21',
  'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27',
  'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
  'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46',
  'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53',
  'WV': '54', 'WI': '55', 'WY': '56',
};

const ISO2_TO_ISO3N = {};
const countryNameToId = {};
(() => {
  const iso2Map = {
    'AF':'004','AL':'008','DZ':'012','AD':'020','AO':'024','AG':'028','AR':'032',
    'AM':'051','AU':'036','AT':'040','AZ':'031','BS':'044','BH':'048','BD':'050',
    'BB':'052','BY':'112','BE':'056','BZ':'084','BJ':'204','BT':'064','BO':'068',
    'BA':'070','BW':'072','BR':'076','BN':'096','BG':'100','BF':'854','BI':'108',
    'KH':'116','CM':'120','CA':'124','CF':'140','TD':'148','CL':'152','CN':'156',
    'CO':'170','KM':'174','CG':'178','CD':'180','CR':'188','CI':'384','HR':'191',
    'CU':'192','CY':'196','CZ':'203','DK':'208','DJ':'262','DM':'212','DO':'214',
    'EC':'218','EG':'818','SV':'222','GQ':'226','ER':'232','EE':'233','ET':'231',
    'FJ':'242','FI':'246','FR':'250','GA':'266','GM':'270','GE':'268','DE':'276',
    'GH':'288','GR':'300','GD':'308','GT':'320','GN':'324','GY':'328','HT':'332',
    'HN':'340','HU':'348','IS':'352','IN':'356','ID':'360','IR':'364','IQ':'368',
    'IE':'372','IL':'376','IT':'380','JM':'388','JP':'392','JO':'400','KZ':'398',
    'KE':'404','KR':'410','KW':'414','KG':'417','LA':'418','LV':'428','LB':'422',
    'LS':'426','LR':'430','LY':'434','LT':'440','LU':'442','MG':'450','MW':'454',
    'MY':'458','ML':'466','MT':'470','MR':'478','MU':'480','MX':'484','MD':'498',
    'MN':'496','ME':'499','MA':'504','MZ':'508','MM':'104','NA':'516','NP':'524',
    'NL':'528','NZ':'554','NI':'558','NE':'562','NG':'566','NO':'578','OM':'512',
    'PK':'586','PA':'591','PG':'598','PY':'600','PE':'604','PH':'608','PL':'616',
    'PT':'620','QA':'634','RO':'642','RU':'643','RW':'646','SA':'682','SN':'686',
    'RS':'688','SL':'694','SG':'702','SK':'703','SI':'705','SO':'706','ZA':'710',
    'ES':'724','LK':'144','SD':'729','SR':'740','SZ':'748','SE':'752','CH':'756',
    'SY':'760','TW':'158','TJ':'762','TZ':'834','TH':'764','TG':'768','TT':'780',
    'TN':'788','TR':'792','TM':'795','UG':'800','UA':'804','AE':'784','GB':'826',
    'US':'840','UY':'858','UZ':'860','VE':'862','VN':'704','YE':'887','ZM':'894',
    'ZW':'716',
  };
  Object.entries(iso2Map).forEach(([k,v]) => { ISO2_TO_ISO3N[k] = v; });
  Object.entries(COUNTRY_LOOKUP).forEach(([id, name]) => {
    countryNameToId[name.toLowerCase()] = id;
  });
})();

const stateNameToId = {};
Object.entries(US_STATE_LOOKUP).forEach(([id, name]) => {
  stateNameToId[name.toLowerCase()] = id;
});

export async function loadGeoLayer(layerId) {
  if (geoCache[layerId]) return geoCache[layerId];

  const url = TOPO_URLS[layerId];
  if (!url) throw new Error(`Unknown geo layer: ${layerId}`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch geo data for ${layerId}`);

  const topo = await resp.json();
  const objKey = TOPO_OBJECT_KEYS[layerId];
  const geojson = topojson.feature(topo, topo.objects[objKey]);
  geoCache[layerId] = geojson;
  return geojson;
}

export function buildMatcher(layerId) {
  if (layerId === 'us-states') {
    return (value) => {
      if (value == null) return null;
      const v = String(value).trim();
      if (US_STATE_LOOKUP[v]) return v;
      const upper = v.toUpperCase();
      if (US_STATE_ABBR[upper]) return US_STATE_ABBR[upper];
      const stripped = upper.startsWith('US-') ? upper.slice(3) : null;
      if (stripped && US_STATE_ABBR[stripped]) return US_STATE_ABBR[stripped];
      const byName = stateNameToId[v.toLowerCase()];
      if (byName) return byName;
      return null;
    };
  }

  return (value) => {
    if (value == null) return null;
    const v = String(value).trim();
    if (COUNTRY_LOOKUP[v]) return v;
    if (v.length === 2) {
      const mapped = ISO2_TO_ISO3N[v.toUpperCase()];
      if (mapped) return mapped;
    }
    const byName = countryNameToId[v.toLowerCase()];
    if (byName) return byName;
    const aliasMap = {
      'usa': '840', 'us': '840', 'united states': '840',
      'uk': '826', 'great britain': '826', 'england': '826',
      'south korea': '410', 'republic of korea': '410',
      'north korea': '408',
      'russia': '643', 'russian federation': '643',
      'iran': '364', 'islamic republic of iran': '364',
      'vietnam': '704', 'viet nam': '704',
      'czech republic': '203', 'czechia': '203',
      'ivory coast': '384', "cote d'ivoire": '384',
      'dr congo': '180', 'drc': '180',
      'uae': '784',
      'taiwan': '158',
    };
    return aliasMap[v.toLowerCase()] || null;
  };
}

export function getFeatureName(layerId, featureId) {
  if (layerId === 'us-states') return US_STATE_LOOKUP[featureId] || featureId;
  return COUNTRY_LOOKUP[featureId] || featureId;
}

export const GEO_LAYERS = [
  { id: 'world', label: 'World Countries', matchHint: 'Country name, ISO 2-letter code, or ISO numeric code' },
  { id: 'us-states', label: 'US States', matchHint: 'State name, 2-letter abbreviation, or FIPS code' },
];
