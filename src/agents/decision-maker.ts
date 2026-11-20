/*
 * Decision-maker finder: names, roles and LinkedIn profiles of owners/managers from the people-search provider
 * (src/providers/people-search; Apollo today). Without one the contact is the role ("Titolare") and the LinkedIn
 * task opens a people search for the company.
 */
export { linkedinSearch, type Person, type PeopleSearch, peopleSearchFromEnv } from "@/providers/people-search";
