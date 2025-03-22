import type {
  PeoplePropertyItemObjectResponse,
  RichTextItemResponse,
  SelectPropertyItemObjectResponse,
  TextRichTextItemResponse,
  TitlePropertyItemObjectResponse,
  UrlPropertyItemObjectResponse,
  UserObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { createNotionAPIError } from "./errors.util";

export const PropertyMappers = {
  /**
   * Maps title property
   */
  title: (prop: TitlePropertyItemObjectResponse): string => {
    const richText = Array.isArray(prop.title) ? prop.title : [prop.title];
    const titleText = richText[0]?.plain_text;
    if (!titleText) {
      throw createNotionAPIError("Title is required");
    }
    return titleText;
  },

  /**
   * Maps select property
   */
  select: (prop: SelectPropertyItemObjectResponse): string => {
    const value = prop.select?.name;
    if (!value) {
      throw createNotionAPIError("Select value is required");
    }
    return value;
  },

  /**
   * Maps people property
   */
  people: (prop: PeoplePropertyItemObjectResponse): string => {
    const firstPerson = Array.from(
      prop.people as unknown as Array<UserObjectResponse>
    )[0];
    if (!firstPerson?.name) {
      throw createNotionAPIError("People name is required");
    }
    return firstPerson.name;
  },

  /**
   * Maps rich text property
   */
  text: (prop: { rich_text: Array<RichTextItemResponse> }): string | null => {
    const textItem = prop.rich_text[0] as TextRichTextItemResponse | undefined;
    return textItem?.plain_text ?? null;
  },

  /**
   * Maps URL property
   */
  url: (prop: UrlPropertyItemObjectResponse): string | null => {
    return prop.url || null;
  },
};
