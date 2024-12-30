export type TranslateFAQRequest = {
  body: {
    text: string;
  }
}

export type TranslateFAQResponse = {
  statusCode: number;
  message: string;
  data: {
    translatedText: string;
  }
}
